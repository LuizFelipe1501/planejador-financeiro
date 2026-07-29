import { parseExpense } from '../lib/gemini.js';
import { sendWhatsApp } from '../lib/whatsapp.js';
import { buildReport } from '../lib/report.js';
import { supabase } from '../lib/supabase.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const REPORT_WORDS = ['relatório', 'relatorio', 'resumo', 'extrato'];
const HELP_WORDS = ['ajuda', 'help', 'menu', '?'];

export default async function handler(req, res) {
  // 1) Verificação do webhook (a Meta chama com GET ao configurar)
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

  // 2) Recebimento de mensagens
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    // Ignora eventos que não são mensagens de texto (status de entrega etc.)
    if (!message || message.type !== 'text') {
      return res.status(200).json({ ignored: true });
    }

    const from = message.from;
    const text = (message.text.body || '').trim();

    // Segurança: só aceita números na lista de permitidos
    const allowed = (process.env.ALLOWED_NUMBERS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(from)) {
      return res.status(200).json({ blocked: true });
    }

    const lower = text.toLowerCase();

    // Comando: relatório sob demanda (grátis, dentro da janela de 24h)
    if (REPORT_WORDS.includes(lower)) {
      const report = await buildReport();
      await sendWhatsApp(from, report);
      return res.status(200).json({ ok: true, action: 'report' });
    }

    // Comando: ajuda
    if (HELP_WORDS.includes(lower)) {
      await sendWhatsApp(
        from,
        [
          'Manda seus gastos em texto normal, tipo:',
          '• "mercado 45"',
          '• "uber 22 ontem"',
          '• "torrei 80 no ifood"',
          '',
          'Comandos:',
          '• "relatório" — resumo do mês',
          '• "ajuda" — esta mensagem',
        ].join('\n')
      );
      return res.status(200).json({ ok: true, action: 'help' });
    }

    // Caso geral: interpreta como gasto
    const parsed = await parseExpense(text);

    if (!parsed?.is_expense) {
      await sendWhatsApp(
        from,
        'Não entendi como gasto. Tenta algo como "mercado 45" ou "uber 22 ontem". Envie "relatório" pra ver o resumo do mês.'
      );
      return res.status(200).json({ ok: true, action: 'not_expense' });
    }

    const row = {
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
    await sendWhatsApp(
      from,
      `Anotado: ${brl.format(row.amount)} em ${row.category}${desc}.`
    );
    return res.status(200).json({ ok: true, action: 'saved' });
  } catch (e) {
    console.error('Erro no webhook:', e);
    // Responde 200 mesmo em erro pra Meta não ficar reenviando o evento
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
