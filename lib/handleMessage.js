import { parseExpense } from './gemini.js';
import { buildReport } from './report.js';
import { supabase } from './supabase.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const REPORT_WORDS = ['relatório', 'relatorio', 'resumo', 'extrato'];
const HELP_WORDS = ['ajuda', 'help', 'menu', '?', 'oi', 'olá', 'ola'];

export function helpText() {
  return [
    'Manda suas transações em texto normal:',
    '• Gasto: "mercado 45", "uber 22 ontem"',
    '• Entrada: "recebi 1300 do estágio", "+500 venda"',
    '• Ou um print do extrato — eu leio tudo.', '',
    'Comandos: "relatório" e "ajuda".',
  ].join('\n');
}

export async function processMessage(user, text) {
  const lower = text.trim().toLowerCase();

  if (REPORT_WORDS.includes(lower)) {
    return { reply: await buildReport(user.id), action: 'report', saved: false };
  }
  if (HELP_WORDS.includes(lower)) {
    return { reply: helpText(), action: 'help', saved: false };
  }

  const parsed = await parseExpense(text);
  if (!parsed?.is_transaction) {
    return {
      reply: 'Não entendi. Ex.: gasto "mercado 45", entrada "recebi 1300 estágio". Ou manda um print do extrato. "relatório" pro resumo.',
      action: 'not_transaction', saved: false,
    };
  }

  const row = {
    user_id: user.id, kind: parsed.kind, amount: parsed.amount,
    category: parsed.category, description: parsed.description || null,
    occurred_at: parsed.occurred_at, raw_message: text, sender: user.phone,
  };
  const { error } = await supabase.from('expenses').insert(row);
  if (error) {
    console.error('Erro ao inserir:', error);
    return { reply: 'Deu erro ao salvar. Tenta de novo.', action: 'error', saved: false };
  }

  const desc = row.description ? ` (${row.description})` : '';
  const verbo = parsed.kind === 'income' ? 'Recebido' : 'Anotado';
  return { reply: `${verbo}: ${brl.format(row.amount)} em ${row.category}${desc}.`, action: 'saved', saved: true };
}
