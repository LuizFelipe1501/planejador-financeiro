import { supabase } from '../lib/supabase.js';

// Endpoint lido pelo dashboard. Protegido por um token simples enviado no
// header x-dashboard-token (comparado com DASHBOARD_TOKEN). É uma proteção
// básica, suficiente para uso pessoal — para algo mais forte, use Supabase Auth.

export default async function handler(req, res) {
  const token = req.headers['x-dashboard-token'];
  if (!process.env.DASHBOARD_TOKEN || token !== process.env.DASHBOARD_TOKEN) {
    return res.status(401).json({ error: 'não autorizado' });
  }

  const now = new Date();
  const monthParam = req.query.month; // 'YYYY-MM' (opcional)
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    [y, m] = monthParam.split('-').map(Number);
  }

  const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
  const end = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('expenses')
    .select('id, amount, category, description, occurred_at, created_at')
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao ler gastos:', error);
    return res.status(500).json({ error: error.message });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    month: `${y}-${String(m).padStart(2, '0')}`,
    expenses: data || [],
  });
}
