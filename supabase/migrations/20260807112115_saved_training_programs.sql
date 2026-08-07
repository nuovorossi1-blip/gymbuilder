create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  duration_weeks smallint not null check (duration_weeks between 2 and 52),
  config jsonb not null,
  week jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_programs enable row level security;

create policy "training_programs_select_own"
  on public.training_programs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "training_programs_insert_own"
  on public.training_programs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "training_programs_update_own"
  on public.training_programs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "training_programs_delete_own"
  on public.training_programs for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.training_programs to authenticated;

create index if not exists training_programs_user_updated_idx
  on public.training_programs (user_id, updated_at desc);
