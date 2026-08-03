import { sendWhatsApp } from '../lib/whatsapp.js';
import { getOrCreateUser } from '../lib/users.js';
import { processMessage } from '../lib/handleMessage.js';

function panelLink(user) {
  const base = process.env.APP_URL;
  return base ? `${base.replace(/\/$/, '')}/painel?t=${user.access_token}` : null;
}
function welcomeMessage(user) {
  const link = panelLink(user);
  const lines = [
    'Opa! Seu Caderno de gastos está pronto. 👋', '',
    'Manda seus gastos em texto normal, tipo:',
    '• "mercado 45"', '• "uber 22 ontem"', '',
    'Comandos: "relatório" e "ajuda".',
  ];
  if (link) lines.push('', `Seu painel: ${link}`);
  return lines.join('\n');
}

// Resposta correta por provedor: Twilio espera TwiML; Meta aceita JSON.
function reply200(res, isTwilio, json) {
  if (isTwilio) {
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  }
  return res.status(200).json(json || { ok: true });
}

export default async function handler(req, res) {
  const body = req.body || {};
  const isTwilio = typeof body.From === 'string' && body.Body !== undefined;

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
    let from, text;
    if (isTwilio) {
      // Twilio: From = "whatsapp:+5561999998888"
      from = String(body.From).replace(/^whatsapp:/, '').replace(/[^\d]/g, '');
      text = String(body.Body || '').trim();
    } else {
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message || message.type !== 'text') return reply200(res, isTwilio, { ignored: true });
      from = message.from;
      text = (message.text?.body || '').trim();
    }

    if (!from || !text) return reply200(res, isTwilio, { ignored: true });

    // Trava de teste opcional
    const allowed = (process.env.ALLOWED_NUMBERS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(from)) return reply200(res, isTwilio, { blocked: true });

    const { user, isNew } = await getOrCreateUser(from);
    if (isNew) await sendWhatsApp(from, welcomeMessage(user));

    const { reply } = await processMessage(user, text);
    await sendWhatsApp(from, reply);
    return reply200(res, isTwilio, { ok: true });
  } catch (e) {
    console.error('Erro no webhook:', e);
    return reply200(res, isTwilio, { ok: false });
  }
}
