-- Rode este SQL no editor do Supabase (SQL Editor > New query).
-- (No projeto caderno-gastos isto já foi aplicado; fica aqui como referência.)

-- Usuários (multiusuário / multi-tenant)
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  phone        text unique not null,
  name         text,
  access_token text unique not null,   -- gerado pelo app; base do link do painel
  timezone     text not null default 'America/Sao_Paulo',
  active        boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Gastos
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null default 'outros',
  description text,
  occurred_at date not null default current_date,
  raw_message text,
  sender      text,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_user_idx
  on public.expenses (user_id, occurred_at desc);

-- RLS ligado, sem policies: só a service role (server) acessa.
alter table public.users enable row level security;
alter table public.expenses enable row level security;
