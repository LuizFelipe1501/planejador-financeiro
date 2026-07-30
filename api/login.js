import { supabase } from '../lib/supabase.js';
import { verifyPassword } from '../lib/auth.js';

// Login por usuário/senha. Devolve o access_token do usuário, que o painel usa
// nas chamadas seguintes (/api/expenses, /api/chat).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'faltam credenciais' });

  const { data: user } = await supabase
    .from('users')
    .select('id, name, username, password_hash, access_token, active')
    .eq('username', String(username).toLowerCase().trim())
    .maybeSingle();

  if (!user || !user.active || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'usuário ou senha inválidos' });
  }

  return res.status(200).json({ token: user.access_token, name: user.name || user.username });
}
