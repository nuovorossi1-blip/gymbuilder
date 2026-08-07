-- Allenamenti salvati e completati (specifica sez. 45-54).
-- I blocchi stanno in jsonb perche' il modello a blocchi (sez. 89) deve reggere
-- anche Metcon, EMOM e Tabata senza campi generici inutilizzati.

create table if not exists public.saved_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null,                  -- bodybuilding | strength | ...
  split text,                          -- push | pull | legs | upper | lower | full_body
  goal text not null,
  experience text not null,
  duration_min smallint not null,
  blocks jsonb not null,               -- warmup + esercizi, gia' con serie/ripetizioni/recuperi
  favorite boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.completed_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_workout_id uuid references public.saved_workouts(id) on delete set null,
  name text not null,
  mode text not null,
  blocks jsonb not null,
  duration_sec integer not null default 0,
  rating text check (rating in ('facile','giusto','duro','troppo_duro')),
  notes text,
  completed_at timestamptz not null default now()
);

create index if not exists saved_workouts_user_idx     on public.saved_workouts (user_id, created_at desc);
create index if not exists completed_workouts_user_idx on public.completed_workouts (user_id, completed_at desc);

alter table public.saved_workouts     enable row level security;
alter table public.completed_workouts enable row level security;

create policy "allenamenti salvati: propri" on public.saved_workouts
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "allenamenti completati: propri" on public.completed_workouts
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);;
