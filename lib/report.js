import { supabase } from './supabase.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function monthBounds(reference) {
  const y = reference.getFullYear(), m = reference.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    monthName: reference.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  };
}

async function fetchMonth(userId, reference) {
  const { start, end } = monthBounds(reference);
  const { data } = await supabase
    .from('expenses')
    .select('amount, category, kind')
    .eq('user_id', userId)
    .gte('occurred_at', start).lte('occurred_at', end);
  return data || [];
}

export async function buildReportData(userId, reference = new Date()) {
  const { monthName } = monthBounds(reference);
  const rows = await fetchMonth(userId, reference);
  const income = rows.filter((r) => r.kind === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.kind !== 'income').reduce((s, r) => s + Number(r.amount), 0);
  return {
    monthName, income, expense, balance: income - expense, count: rows.length,
    incomeStr: brl.format(income), expenseStr: brl.format(expense), balanceStr: brl.format(income - expense),
  };
}

export async function buildReport(userId, reference = new Date()) {
  const { monthName } = monthBounds(reference);
  const rows = await fetchMonth(userId, reference);
  if (!rows.length) return `Resumo de ${monthName}\n\nNenhum lançamento neste mês ainda.`;

  const income = rows.filter((r) => r.kind === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expenses = rows.filter((r) => r.kind !== 'income');
  const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);

  const byCat = {};
  for (const r of expenses) byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount);
  const lines = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `• ${c}: ${brl.format(v)}`);

  return [
    `Resumo de ${monthName}`, '',
    `Entradas: ${brl.format(income)}`,
    `Saídas: ${brl.format(expenseTotal)}`,
    `Saldo: ${brl.format(income - expenseTotal)}`,
    '', 'Gastos por categoria:', ...lines,
  ].join('\n');
}
