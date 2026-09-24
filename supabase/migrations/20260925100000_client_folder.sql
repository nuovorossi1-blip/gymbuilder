-- Fase 2 (25/09): cartella del cliente, una per utente. Il contenuto è JSON (CartellaCliente
-- in src/features/cartella/types.ts): il Coach LLM la legge e la aggiorna, l'utente la modifica
-- a mano, la esporta e la reimporta in formato .md.
create table if not exists public.client_folder (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.client_folder enable row level security;
create policy "client_folder select own" on public.client_folder for select using ((select auth.uid()) = user_id);
create policy "client_folder insert own" on public.client_folder for insert with check ((select auth.uid()) = user_id);
create policy "client_folder update own" on public.client_folder for update using ((select auth.uid()) = user_id);
create policy "client_folder delete own" on public.client_folder for delete using ((select auth.uid()) = user_id);
