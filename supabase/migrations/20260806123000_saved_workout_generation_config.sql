alter table public.saved_workouts
  add column if not exists generation_config jsonb;

comment on column public.saved_workouts.generation_config is
  'Configurazione globale e del singolo giorno usata per generare il workout.';
