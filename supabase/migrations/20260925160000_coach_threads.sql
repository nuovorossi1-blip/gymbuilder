-- 25/09: conversazioni separate con il Coach (nuova chat + storico) e schede salvate dal
-- programma del Coach riconoscibili in Salvati.
alter table public.coach_messages add column if not exists thread_id uuid;
create index if not exists coach_messages_thread on public.coach_messages (user_id, thread_id, created_at);
alter table public.saved_workouts add column if not exists origine text check (origine is null or origine in ('coach'));
