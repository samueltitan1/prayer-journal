begin;

-- Legacy tester cohort selected by product decision:
-- users created before 2026-04-04 should retain app access without paid plan.
with legacy_users as (
  select id
  from auth.users
  where created_at < '2026-04-04'::timestamptz
)
insert into public.subscriptions (
  user_id,
  plan,
  status,
  access_override,
  access_override_reason,
  last_validated_at,
  provider_meta
)
select
  lu.id,
  'free',
  'active',
  true,
  'legacy_tester_pre_2026_04_04',
  now(),
  jsonb_build_object('source', 'legacy_backfill', 'cutoff', '2026-04-04')
from legacy_users lu
on conflict (user_id) do update
set
  -- Keep existing plan/status when present, but always grant legacy override.
  plan = coalesce(public.subscriptions.plan, excluded.plan),
  status = coalesce(public.subscriptions.status, excluded.status),
  access_override = true,
  access_override_reason = coalesce(
    public.subscriptions.access_override_reason,
    excluded.access_override_reason
  ),
  access_override_expires_at = null,
  last_validated_at = coalesce(public.subscriptions.last_validated_at, now()),
  provider_meta = coalesce(public.subscriptions.provider_meta, excluded.provider_meta);

with legacy_users as (
  select id
  from auth.users
  where created_at < '2026-04-04'::timestamptz
)
insert into public.onboarding_responses (
  user_id,
  onboarding_started_at,
  onboarding_completed_at,
  onboarding_step,
  onboarding_last_seen_at
)
select
  lu.id,
  now(),
  now(),
  null,
  now()
from legacy_users lu
on conflict (user_id) do update
set
  -- If a legacy user never completed onboarding, mark completed to avoid auth-flow loops.
  onboarding_completed_at = coalesce(public.onboarding_responses.onboarding_completed_at, now()),
  onboarding_step = case
    when public.onboarding_responses.onboarding_completed_at is null then null
    else public.onboarding_responses.onboarding_step
  end,
  onboarding_last_seen_at = coalesce(public.onboarding_responses.onboarding_last_seen_at, now());

commit;
