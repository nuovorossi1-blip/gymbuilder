alter table public.user_settings
  add column weight_kg smallint check (weight_kg is null or (weight_kg >= 30 and weight_kg <= 250)),
  add column default_intensity text not null default 'medium'
    check (default_intensity = any (array['low','medium','high']));;
