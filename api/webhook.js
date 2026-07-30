import { parseExpense } from '../lib/gemini.js';
import { sendWhatsApp } from '../lib/whatsapp.js';
import { buildReport } from '../lib/report.js';
import { supabase } from '../lib/supabase.js';
import { getOrCreateUser } from '../lib/users.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const REPORT_WORDS = ['relatório', 'relatorio', 'resumo', 'extrato'];
const HELP_WORDS = ['ajuda', 'help', 'menu', '?', 'oi', 'olá', 'ola'];

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
    '• "torrei 80 no ifood"',
    '',
    'Comandos: "relatório" (resumo do mês) e "ajuda".',
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

    // Trava de teste (opcional): se ALLOWED_NUMBERS estiver definido, só esses
    // números entram. Vazio = onboarding aberto a qualquer um.
    const allowed = (process.env.ALLOWED_NUMBERS || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(from)) {
      return res.status(200).json({ blocked: true });
    }

    // Onboarding automático
    const { user, isNew } = await getOrCreateUser(from);
    if (isNew) {
      await sendWhatsApp(from, welcomeMessage(user));
      // segue e processa a própria mensagem que a pessoa mandou
    }

    const lower = text.toLowerCase();

    if (REPORT_WORDS.includes(lower)) {
      const report = await buildReport(user.id);
      await sendWhatsApp(from, report);
      return res.status(200).json({ ok: true, action: 'report' });
    }

    if (HELP_WORDS.includes(lower)) {
      if (!isNew) await sendWhatsApp(from, welcomeMessage(user));
      return res.status(200).json({ ok: true, action: 'help' });
    }

    // Caso geral: interpreta como gasto
    const parsed = await parseExpense(text);
    if (!parsed?.is_expense) {
      await sendWhatsApp(from, 'Não entendi como gasto. Tenta "mercado 45" ou "uber 22 ontem". Envie "relatório" pro resumo do mês.');
      return res.status(200).json({ ok: true, action: 'not_expense' });
    }

    const row = {
      user_id: user.id,
      amount: parsed.amount,
      category: parsed.category,
      description: parsed.description || null,
      occurred_at: parsed.occurred_at,
      raw_message: text,
      sender: from,
    };
    const { error } = await supabase.from('expenses').insert(row);
    if (error) {
      console.error('Erro ao inserir gasto:', error);
      await sendWhatsApp(from, 'Deu erro ao salvar. Tenta de novo em instantes.');
      return res.status(200).json({ ok: false });
    }

    const desc = row.description ? ` (${row.description})` : '';
    await sendWhatsApp(from, `Anotado: ${brl.format(row.amount)} em ${row.category}${desc}.`);
    return res.status(200).json({ ok: true, action: 'saved' });
  } catch (e) {
    console.error('Erro no webhook:', e);
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
