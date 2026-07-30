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
    'Opa! Seu Caderno de gastos está pronto. 👋',
    '',
    'Manda seus gastos em texto normal, tipo:',
    '• "mercado 45"',
    '• "uber 22 ontem"',
    '',
    'Comandos: "relatório" e "ajuda".',
  ];
  if (link) lines.push('', `Seu painel: ${link}`);
  return lines.join('\n');
}

export default async function handler(req, res) {
  // Verificação do webhook (GET da Meta)
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
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message || message.type !== 'text') return res.status(200).json({ ignored: true });

    const from = message.from;
    const text = (message.text.body || '').trim();

    // Trava de teste opcional
    const allowed = (process.env.ALLOWED_NUMBERS || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(from)) return res.status(200).json({ blocked: true });

    // Onboarding automático
    const { user, isNew } = await getOrCreateUser(from);
    if (isNew) await sendWhatsApp(from, welcomeMessage(user));

    // Motor compartilhado
    const { reply } = await processMessage(user, text);
    await sendWhatsApp(from, reply);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Erro no webhook:', e);
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
