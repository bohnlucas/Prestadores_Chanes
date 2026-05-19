-- Execute este SQL no SQL Editor do Supabase (Project → SQL Editor → New query)

create table if not exists providers (
  id text primary key,
  name text not null,
  company text,
  service_type text,
  phone text,
  email text,
  budget numeric,
  status text default 'contato_inicial',
  referred_by text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilita RLS e libera acesso anônimo (app sem login)
alter table providers enable row level security;

create policy "anon read"   on providers for select using (true);
create policy "anon insert" on providers for insert with check (true);
create policy "anon update" on providers for update using (true);
create policy "anon delete" on providers for delete using (true);
