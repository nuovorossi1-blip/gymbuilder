-- Mantiene compatibile la PK storica `id` con il contratto corrente `user_id`.
update public.profiles
set user_id = id
where user_id is null;

alter table public.profiles
  alter column user_id set not null;

-- Le policy correnti su user_id sostituiscono quelle storiche su id.
drop policy if exists "profilo proprio: lettura" on public.profiles;
drop policy if exists "profilo proprio: modifica" on public.profiles;
drop policy if exists "profilo proprio: creazione" on public.profiles;

-- I nuovi utenti devono ricevere entrambe le chiavi, che rappresentano lo
-- stesso proprietario finché la PK legacy resta necessaria.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, user_id, display_name)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
