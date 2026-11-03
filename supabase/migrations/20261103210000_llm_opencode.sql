-- 03/11/2026: terzo fornitore LLM, OpenCode Zen (modelli gratuiti come GLM-5.3-Flash Free).
-- Solo aggiunte: le chiavi DeepSeek/OpenRouter già salvate restano come sono.
alter table public.user_llm_keys
  add column if not exists opencode_key text check (opencode_key is null or length(opencode_key) between 10 and 300);
alter table public.user_llm_keys drop constraint if exists user_llm_keys_provider_check;
alter table public.user_llm_keys add constraint user_llm_keys_provider_check check (provider in ('deepseek','openrouter','opencode'));

drop function if exists public.llm_keys_stato();
create function public.llm_keys_stato()
returns table(provider text, model text, ha_deepseek boolean, ha_openrouter boolean, ha_opencode boolean)
language sql stable security invoker set search_path = public
as $$
  select provider, model, deepseek_key is not null or (provider = 'deepseek' and api_key is not null),
         openrouter_key is not null or (provider = 'openrouter' and api_key is not null),
         opencode_key is not null
  from public.user_llm_keys where user_id = auth.uid()
$$;
grant execute on function public.llm_keys_stato() to authenticated;
