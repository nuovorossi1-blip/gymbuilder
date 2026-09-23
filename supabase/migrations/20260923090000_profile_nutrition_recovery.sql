-- Fase nutrizionale e recupero (23/09): dati usati dal motore per calibrare volume,
-- RIR, tecniche e interleave (prompt di programmazione di Rossi, Principio 5).
alter table public.profiles
  add column if not exists daily_kcal integer check (daily_kcal is null or daily_kcal between 800 and 8000),
  add column if not exists job_activity text check (job_activity is null or job_activity in ('sedentary','active','very_active')),
  add column if not exists weight_trend text check (weight_trend is null or weight_trend in ('losing','stable','gaining')),
  add column if not exists sleep_hours numeric(3,1) check (sleep_hours is null or sleep_hours between 3 and 12),
  add column if not exists stress_level text check (stress_level is null or stress_level in ('low','medium','high')),
  add column if not exists joint_issues text[] not null default '{}';
