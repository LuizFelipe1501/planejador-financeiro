import { getUserByToken } from '../lib/users.js';
import { processMessage } from '../lib/handleMessage.js';

// Chat simulador do painel: recebe uma mensagem, roda o MESMO motor do WhatsApp
// (Gemini + gravação no Supabase) e devolve a resposta do bot.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { t, message } = req.body || {};

  const user = await getUserByToken(t);
  if (!user) return res.status(401).json({ error: 'não autorizado' });
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'mensagem vazia' });

  try {
    const result = await processMessage(user, String(message).trim());
    return res.status(200).json(result);
  } catch (e) {
    console.error('Erro no chat:', e);
    return res.status(200).json({ reply: 'Deu um erro aqui. Tenta de novo.', action: 'error', saved: false });
  }
}
