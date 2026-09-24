-- 25/09: una chiave per fornitore (DeepSeek e OpenRouter) e funzione che dice solo SE ci sono.
alter table public.user_llm_keys
  add column if not exists deepseek_key text check (deepseek_key is null or length(deepseek_key) between 10 and 300),
  add column if not exists openrouter_key text check (openrouter_key is null or length(openrouter_key) between 10 and 300);
update public.user_llm_keys set deepseek_key = coalesce(deepseek_key, api_key) where provider = 'deepseek' and api_key is not null;
update public.user_llm_keys set openrouter_key = coalesce(openrouter_key, api_key) where provider = 'openrouter' and api_key is not null;
alter table public.user_llm_keys alter column api_key drop not null;
alter table public.user_llm_keys drop constraint if exists user_llm_keys_api_key_check;
alter table public.user_llm_keys add constraint user_llm_keys_api_key_check check (api_key is null or length(api_key) between 10 and 300);

create or replace function public.llm_keys_stato()
returns table(provider text, model text, ha_deepseek boolean, ha_openrouter boolean)
language sql stable security invoker set search_path = public
as $$
  select provider, model, deepseek_key is not null or (provider = 'deepseek' and api_key is not null),
         openrouter_key is not null or (provider = 'openrouter' and api_key is not null)
  from public.user_llm_keys where user_id = auth.uid()
$$;
grant execute on function public.llm_keys_stato() to authenticated;
