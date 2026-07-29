-- Rode este SQL no editor do Supabase (SQL Editor > New query).

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null default 'outros',
  description text,
  occurred_at date not null default current_date,
  raw_message text,
  sender      text,
  created_at  timestamptz not null default now()
);

-- Índice para as consultas por mês (dashboard e relatório)
create index if not exists expenses_occurred_at_idx
  on public.expenses (occurred_at desc);

-- RLS ligado, sem policies públicas: ninguém acessa via anon key.
-- As funções serverless usam a service role key, que ignora o RLS.
alter table public.expenses enable row level security;

-- (Opcional) categorias válidas, caso queira travar no banco também:
-- alter table public.expenses
--   add constraint expenses_category_chk
--   check (category in (
--     'alimentação','transporte','moradia','lazer','saúde',
--     'educação','compras','assinaturas','contas','outros'
--   ));
