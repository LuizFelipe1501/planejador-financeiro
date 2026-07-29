import { createClient } from '@supabase/supabase-js';

// Usa a service role key: roda apenas no servidor (funções serverless),
// nunca no navegador. Ela ignora o RLS, por isso mantenha-a fora do front.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
