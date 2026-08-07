-- GymBuilder - Fase 2: database esercizi (specifica sez. 27-33)
-- Fonte di verita' della generazione. Il frontend non contiene liste hardcoded.

create table if not exists public.exercises (
  id text primary key,
  name text not null,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text not null,                 -- barbell|dumbbell|machine|cable|bodyweight|kettlebell|cardio
  movement_pattern text not null,
  roles text[] not null default '{}',      -- compound|isolation|strength|hypertrophy|conditioning|cardio|core|warmup
  min_experience text not null default 'beginner'
    check (min_experience in ('beginner','intermediate','advanced')),
  technical_complexity smallint not null default 1 check (technical_complexity between 1 and 3),
  systemic_fatigue    smallint not null default 1 check (systemic_fatigue between 1 and 3),
  local_fatigue       smallint not null default 1 check (local_fatigue between 1 and 3),
  grip_fatigue        smallint not null default 1 check (grip_fatigue between 1 and 3),
  cardio_demand       smallint not null default 1 check (cardio_demand between 1 and 3),
  default_sets smallint not null default 3,
  default_reps text not null default '8-12',
  default_rest smallint not null default 90,   -- secondi
  active boolean not null default true
);

create index if not exists exercises_primary_muscles_idx on public.exercises using gin (primary_muscles);
create index if not exists exercises_roles_idx           on public.exercises using gin (roles);

alter table public.exercises enable row level security;

-- Il catalogo e' pubblico in lettura per chi ha fatto l'accesso; nessuno puo' scriverlo dal client
create policy "esercizi: lettura per utenti autenticati" on public.exercises
  for select to authenticated using (true);;
