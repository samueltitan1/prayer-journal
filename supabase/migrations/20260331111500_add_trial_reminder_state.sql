-- Trial reminder state for RevenueCat-driven local reminder scheduling.
alter table if exists public.subscriptions
  add column if not exists period_type text,
  add column if not exists trial_started_at timestamp with time zone,
  add column if not exists trial_ends_at timestamp with time zone,
  add column if not exists auto_renew_enabled boolean,
  add column if not exists cancellation_detected_at timestamp with time zone,
  add column if not exists latest_event_type text,
  add column if not exists trial_reminder_dedupe_key text,
  add column if not exists trial_reminder_scheduled_at timestamp with time zone,
  add column if not exists trial_reminder_inapp_shown_at timestamp with time zone;

create index if not exists subscriptions_status_period_end_idx
  on public.subscriptions (status, current_period_end);

create index if not exists subscriptions_trial_ends_idx
  on public.subscriptions (trial_ends_at)
  where status = 'trialing';

create index if not exists subscriptions_last_validated_idx
  on public.subscriptions (last_validated_at desc);

create index if not exists subscriptions_trial_reminder_key_idx
  on public.subscriptions (user_id, trial_reminder_dedupe_key);
