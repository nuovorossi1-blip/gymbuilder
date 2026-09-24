-- Fase 3 (25/09): LLM e chiave per utente, piani del Coach (versioni, rotazione), conversazione.
create table if not exists public.user_llm_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('deepseek','openrouter')),
  model text not null check (length(model) between 1 and 120),
  api_key text not null check (length(api_key) between 10 and 300),
  updated_at timestamptz not null default now()
);
alter table public.user_llm_keys enable row level security;
create policy "llm keys select own" on public.user_llm_keys for select using ((select auth.uid()) = user_id);
create policy "llm keys insert own" on public.user_llm_keys for insert with check ((select auth.uid()) = user_id);
create policy "llm keys update own" on public.user_llm_keys for update using ((select auth.uid()) = user_id);
create policy "llm keys delete own" on public.user_llm_keys for delete using ((select auth.uid()) = user_id);

create table if not exists public.coach_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('attivo','archiviato')),
  source text not null check (source in ('colloquio','controllo','chat')),
  plan jsonb not null,
  next_index integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists coach_plans_user on public.coach_plans (user_id, created_at desc);
alter table public.coach_plans enable row level security;
create policy "coach plans select own" on public.coach_plans for select using ((select auth.uid()) = user_id);
create policy "coach plans insert own" on public.coach_plans for insert with check ((select auth.uid()) = user_id);
create policy "coach plans update own" on public.coach_plans for update using ((select auth.uid()) = user_id);
create policy "coach plans delete own" on public.coach_plans for delete using ((select auth.uid()) = user_id);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('coach','utente')),
  kind text not null check (kind in ('colloquio','controllo','chat')),
  content text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user on public.coach_messages (user_id, created_at);
alter table public.coach_messages enable row level security;
create policy "coach messages select own" on public.coach_messages for select using ((select auth.uid()) = user_id);
create policy "coach messages insert own" on public.coach_messages for insert with check ((select auth.uid()) = user_id);
create policy "coach messages delete own" on public.coach_messages for delete using ((select auth.uid()) = user_id);
