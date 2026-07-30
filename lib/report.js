import { supabase } from './supabase.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function monthBounds(reference) {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    monthName: reference.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  };
}

// Números-chave do mês para o template do relatório (de um usuário).
export async function buildReportData(userId, reference = new Date()) {
  const { start, end, monthName } = monthBounds(reference);
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, category')
    .eq('user_id', userId)
    .gte('occurred_at', start)
    .lte('occurred_at', end);

  if (error || !data || data.length === 0) {
    return { monthName, total: 0, count: 0, topCategory: '-', totalStr: brl.format(0) };
  }
  const total = data.reduce((s, r) => s + Number(r.amount), 0);
  const byCat = {};
  for (const r of data) byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount);
  const topCategory = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0][0];
  return { monthName, total, count: data.length, topCategory, totalStr: brl.format(total) };
}

// Texto do resumo (usado na resposta a "relatório", dentro da janela).
export async function buildReport(userId, reference = new Date()) {
  const { start, end, monthName } = monthBounds(reference);
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, category, occurred_at')
    .eq('user_id', userId)
    .gte('occurred_at', start)
    .lte('occurred_at', end);

  if (error) return 'Não consegui gerar o relatório agora. Tenta de novo em instantes.';
  if (!data || data.length === 0) return `Resumo de ${monthName}\n\nNenhum gasto registrado ainda neste mês.`;

  const total = data.reduce((s, r) => s + Number(r.amount), 0);
  const byCategory = {};
  for (const r of data) byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount);
  const lines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value]) => `• ${cat}: ${brl.format(value)} (${Math.round((value / total) * 100)}%)`);

  return [
    `Resumo de ${monthName}`, '',
    `Total: ${brl.format(total)}`,
    `${data.length} lançamento${data.length > 1 ? 's' : ''}`, '',
    'Por categoria:', ...lines,
  ].join('\n');
}
