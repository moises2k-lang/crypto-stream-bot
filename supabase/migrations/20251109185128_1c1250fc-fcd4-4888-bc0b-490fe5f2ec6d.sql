-- Create secure table for per-user exchange API credentials
create table if not exists public.exchange_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  exchange_name text not null,
  api_key_ciphertext text not null,
  api_key_iv text not null,
  api_secret_ciphertext text not null,
  api_secret_iv text not null,
  salt text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint exchange_credentials_user_exchange_unique unique (user_id, exchange_name)
);

-- Enable RLS and strict owner-only access
alter table public.exchange_credentials enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'exchange_credentials' and policyname = 'Users can view own exchange credentials'
  ) then
    create policy "Users can view own exchange credentials"
    on public.exchange_credentials
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'exchange_credentials' and policyname = 'Users can insert own exchange credentials'
  ) then
    create policy "Users can insert own exchange credentials"
    on public.exchange_credentials
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'exchange_credentials' and policyname = 'Users can update own exchange credentials'
  ) then
    create policy "Users can update own exchange credentials"
    on public.exchange_credentials
    for update
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'exchange_credentials' and policyname = 'Users can delete own exchange credentials'
  ) then
    create policy "Users can delete own exchange credentials"
    on public.exchange_credentials
    for delete
    using (auth.uid() = user_id);
  end if;
end $$;

-- Keep updated_at fresh
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger update_exchange_credentials_updated_at
before update on public.exchange_credentials
for each row execute function public.update_updated_at_column();

-- Add uniqueness on (user_id, exchange_name) to exchange_connections so we can upsert safely
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'exchange_connections_user_exchange_unique'
  ) then
    alter table public.exchange_connections
    add constraint exchange_connections_user_exchange_unique unique (user_id, exchange_name);
  end if;
end $$;