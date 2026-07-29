import { supabase } from './supabase.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Monta o texto do resumo do mês corrente (ou de um mês específico).
export async function buildReport(reference = new Date()) {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('expenses')
    .select('amount, category, occurred_at')
    .gte('occurred_at', start)
    .lte('occurred_at', end);

  if (error) {
    console.error('Erro ao gerar relatório:', error);
    return 'Não consegui gerar o relatório agora. Tenta de novo em instantes.';
  }

  const monthName = reference.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  if (!data || data.length === 0) {
    return `Resumo de ${monthName}\n\nNenhum gasto registrado ainda neste mês.`;
  }

  const total = data.reduce((s, r) => s + Number(r.amount), 0);

  const byCategory = {};
  for (const r of data) {
    byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount);
  }

  const lines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value]) => {
      const pct = Math.round((value / total) * 100);
      return `• ${cat}: ${brl.format(value)} (${pct}%)`;
    });

  return [
    `Resumo de ${monthName}`,
    '',
    `Total: ${brl.format(total)}`,
    `${data.length} lançamento${data.length > 1 ? 's' : ''}`,
    '',
    'Por categoria:',
    ...lines,
  ].join('\n');
}
