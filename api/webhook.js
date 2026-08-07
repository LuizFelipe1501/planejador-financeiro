import { sendWhatsApp, fetchTwilioMedia } from '../lib/whatsapp.js';
import { getOrCreateUser, getUserByPhone, normalizePhone } from '../lib/users.js';
import { processMessage } from '../lib/handleMessage.js';
import { parseExpensesFromImage } from '../lib/gemini.js';
import { supabase } from '../lib/supabase.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function panelLink(user) {
  const base = process.env.APP_URL;
  return base ? `${base.replace(/\/$/, '')}/painel?t=${user.access_token}` : null;
}
function welcomeMessage(user) {
  const link = panelLink(user);
  const lines = [
    'Opa! Aqui é o seu Caderno de gastos. 👋', '',
    'É simples: sempre que gastar, me manda aqui.',
    '• Em texto: "mercado 45", "uber 22 ontem"',
    '• Ou um print do extrato/fatura — eu leio os gastos sozinho.', '',
    'Tudo aparece organizado no seu painel.',
  ];
  if (link) lines.push('', `Painel: ${link}`);
  lines.push('', 'Comandos: "relatório" e "ajuda".');
  return lines.join('\n');
}
function reply200(res, isTwilio, json) {
  if (isTwilio) {
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  }
  return res.status(200).json(json || { ok: true });
}

export default async function handler(req, res) {
  const body = req.body || {};
  const isTwilio = typeof body.From === 'string' && (body.Body !== undefined || body.NumMedia !== undefined);

  // Verificação do webhook (só Meta usa GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }
  if (req.method !== 'POST') return res.status(405).end();

  try {
    let from = '';
    let text = '';
    let mediaUrl = null;
    let mediaType = '';

    if (isTwilio) {
      from = normalizePhone(String(body.From).replace(/^whatsapp:/, ''));
      text = String(body.Body || '').trim();
      const numMedia = parseInt(body.NumMedia || '0', 10);
      if (numMedia > 0) {
        mediaUrl = body.MediaUrl0;
        mediaType = body.MediaContentType0 || '';
      }
    } else {
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) return reply200(res, isTwilio, { ignored: true });
      from = normalizePhone(message.from);
      if (message.type === 'text') text = (message.text?.body || '').trim();
    }

    if (!from) return reply200(res, isTwilio, { ignored: true });

    // Liberação: quem já está cadastrado (tabela) sempre passa. Número
    // desconhecido só passa se ALLOWED_NUMBERS estiver vazio (onboarding aberto)
    // ou se estiver listado nela.
    const known = await getUserByPhone(from);
    if (!known) {
      const allowed = (process.env.ALLOWED_NUMBERS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(from)) return reply200(res, isTwilio, { blocked: true });
    }

    const { user, isNew } = known ? { user: known, isNew: false } : await getOrCreateUser(from);
    if (isNew) await sendWhatsApp(from, welcomeMessage(user));

    // 1) Print do extrato (imagem)
    if (mediaUrl && mediaType.startsWith('image/')) {
      const media = await fetchTwilioMedia(mediaUrl);
      if (!media) {
        await sendWhatsApp(from, 'Não consegui baixar a imagem. Tenta enviar de novo.');
        return reply200(res, isTwilio, { ok: false });
      }
      let txns = [];
      try {
        txns = await parseExpensesFromImage(media.base64, media.mime);
      } catch (e) {
        console.error('Erro na visão:', e);
      }
      if (!txns.length) {
        await sendWhatsApp(from, 'Não identifiquei lançamentos nesse print. Manda um extrato/fatura mais nítido, ou digita (ex.: "mercado 45").');
        return reply200(res, isTwilio, { ok: true });
      }
      const rows = txns.map((e) => ({
        user_id: user.id, kind: e.kind, amount: e.amount, category: e.category,
        description: e.description, occurred_at: e.occurred_at,
        raw_message: '[print de extrato]', sender: from,
      }));
      const { error } = await supabase.from('expenses').insert(rows);
      if (error) {
        console.error('Erro ao salvar print:', error);
        await sendWhatsApp(from, 'Deu erro ao salvar os lançamentos do print. Tenta de novo.');
        return reply200(res, isTwilio, { ok: false });
      }
      const saidas = txns.filter((t) => t.kind !== 'income');
      const entradas = txns.filter((t) => t.kind === 'income');
      const totalSaida = saidas.reduce((s, e) => s + e.amount, 0);
      const totalEntrada = entradas.reduce((s, e) => s + e.amount, 0);
      const partes = [];
      if (saidas.length) partes.push(`${saidas.length} saída${saidas.length > 1 ? 's' : ''} (${brl.format(totalSaida)})`);
      if (entradas.length) partes.push(`${entradas.length} entrada${entradas.length > 1 ? 's' : ''} (${brl.format(totalEntrada)})`);
      await sendWhatsApp(from, `Reconheci ${partes.join(' e ')} no print. Já estão no seu painel.`);
      return reply200(res, isTwilio, { ok: true, count: txns.length });
    }

    // 2) Texto
    if (!text) {
      await sendWhatsApp(from, 'Manda o gasto em texto (ex.: "mercado 45") ou um print do extrato.');
      return reply200(res, isTwilio, { ignored: true });
    }
    const { reply } = await processMessage(user, text);
    await sendWhatsApp(from, reply);
    return reply200(res, isTwilio, { ok: true });
  } catch (e) {
    console.error('Erro no webhook:', e);
    return reply200(res, isTwilio, { ok: false });
  }
}
