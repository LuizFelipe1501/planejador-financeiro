import crypto from 'node:crypto';
import { supabase } from './supabase.js';

// Normaliza número brasileiro para casar independentemente do nono dígito.
// A Twilio às vezes entrega +55 DDD 9XXXXXXXX (13 díg.) e às vezes sem o 9 (12).
// Canônico = forma SEM o nono dígito (12 dígitos).
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') {
    d = d.slice(0, 4) + d.slice(5);
  }
  return d;
}

// Acha o usuário pelo número; se não existir, cria (onboarding automático).
// Retorna { user, isNew }.
export async function getOrCreateUser(rawPhone) {
  const phone = normalizePhone(rawPhone);
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (existing) return { user: existing, isNew: false };

  const access_token = crypto.randomBytes(12).toString('hex');
  const { data: created, error } = await supabase
    .from('users')
    .insert({ phone, access_token })
    .select('*')
    .single();

  if (error) {
    // corrida: outro webhook criou o usuário no meio do caminho
    const { data: again } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    if (again) return { user: again, isNew: false };
    throw error;
  }
  return { user: created, isNew: true };
}

// Resolve o usuário pelo token de acesso (usado pelo painel).
export async function getUserByToken(token) {
  if (!token) return null;
  const { data } = await supabase
    .from('users')
    .select('id, phone, name, timezone')
    .eq('access_token', token)
    .eq('active', true)
    .maybeSingle();
  return data || null;
}

// Todos os usuários ativos (usado pelo relatório agendado).
export async function listActiveUsers() {
  const { data } = await supabase
    .from('users')
    .select('id, phone, timezone')
    .eq('active', true);
  return data || [];
}
