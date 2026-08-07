import crypto from 'node:crypto';
import { supabase } from '../lib/supabase.js';
import { hashPassword } from '../lib/auth.js';
import { normalizePhone } from '../lib/users.js';

// Cadastro público de perfil (para validação de MVP). Registrar já libera o
// número no WhatsApp, porque a lista de liberados é a própria tabela de usuários.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let { name, phone, username, password } = req.body || {};
  name = String(name || '').trim();
  username = String(username || '').toLowerCase().trim();
  phone = normalizePhone(phone);
  password = String(password || '');

  if (!name || !username || !phone || !password) {
    return res.status(400).json({ error: 'Preencha nome, telefone, usuário e senha.' });
  }
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Usuário: 3 a 20 letras, números, ponto ou _.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha muito curta (mínimo 6).' });
  }
  if (phone.length < 12) {
    return res.status(400).json({ error: 'Telefone inválido. Use DDD + número.' });
  }

  const access_token = crypto.randomBytes(12).toString('hex');
  const password_hash = hashPassword(password);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ name, phone, username, password_hash, access_token })
    .select('access_token, name')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Usuário ou telefone já cadastrado.' });
    }
    console.error('Erro no signup:', error);
    return res.status(500).json({ error: 'Erro ao criar conta. Tenta de novo.' });
  }

  return res.status(200).json({ token: user.access_token, name: user.name });
}
