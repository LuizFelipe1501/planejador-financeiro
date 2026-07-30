import { parseExpense } from './gemini.js';
import { buildReport } from './report.js';
import { supabase } from './supabase.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const REPORT_WORDS = ['relatório', 'relatorio', 'resumo', 'extrato'];
const HELP_WORDS = ['ajuda', 'help', 'menu', '?', 'oi', 'olá', 'ola'];

export function helpText() {
  return [
    'Manda seus gastos em texto normal, tipo:',
    '• "mercado 45"',
    '• "uber 22 ontem"',
    '• "torrei 80 no ifood"',
    '',
    'Comandos: "relatório" (resumo do mês) e "ajuda".',
  ].join('\n');
}

// Processa UMA mensagem de um usuário já resolvido. Usado tanto pelo webhook do
// WhatsApp quanto pelo chat simulador do painel. Retorna { reply, action, saved }.
export async function processMessage(user, text) {
  const lower = text.trim().toLowerCase();

  if (REPORT_WORDS.includes(lower)) {
    const report = await buildReport(user.id);
    return { reply: report, action: 'report', saved: false };
  }

  if (HELP_WORDS.includes(lower)) {
    return { reply: helpText(), action: 'help', saved: false };
  }

  const parsed = await parseExpense(text);
  if (!parsed?.is_expense) {
    return {
      reply: 'Não entendi como gasto. Tenta "mercado 45" ou "uber 22 ontem". Envie "relatório" pro resumo do mês.',
      action: 'not_expense',
      saved: false,
    };
  }

  const row = {
    user_id: user.id,
    amount: parsed.amount,
    category: parsed.category,
    description: parsed.description || null,
    occurred_at: parsed.occurred_at,
    raw_message: text,
    sender: user.phone,
  };
  const { error } = await supabase.from('expenses').insert(row);
  if (error) {
    console.error('Erro ao inserir gasto:', error);
    return { reply: 'Deu erro ao salvar. Tenta de novo em instantes.', action: 'error', saved: false };
  }

  const desc = row.description ? ` (${row.description})` : '';
  return {
    reply: `Anotado: ${brl.format(row.amount)} em ${row.category}${desc}.`,
    action: 'saved',
    saved: true,
  };
}
