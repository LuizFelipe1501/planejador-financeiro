import { supabase } from '../lib/supabase.js';
import { getUserByToken } from '../lib/users.js';

// Painel multiusuário: cada pessoa acessa pelo link com ?t=<access_token>
// (enviado no onboarding via WhatsApp). Sem token, não há dados a mostrar.
export default async function handler(req, res) {
  const user = await getUserByToken(req.query.t);
  if (!user) return res.status(401).json({ error: 'link inválido ou expirado' });

  const now = new Date();
  const monthParam = req.query.month;
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
    .eq('user_id', user.id)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    month: `${y}-${String(m).padStart(2, '0')}`,
    user: { name: user.name || null },
    expenses: data || [],
  });
}
