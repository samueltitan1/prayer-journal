alter table if exists public.onboarding_responses
  add column if not exists q9 text[];
