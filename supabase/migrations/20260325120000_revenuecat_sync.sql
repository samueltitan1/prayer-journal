-- RevenueCat subscription sync support.
alter table if exists public.subscriptions
  add column if not exists provider text,
  add column if not exists last_validated_at timestamp with time zone,
  add column if not exists environment text,
  add column if not exists apple_product_id text,
  add column if not exists apple_transaction_id text,
  add column if not exists apple_original_transaction_id text,
  add column if not exists revenuecat_app_user_id text,
  add column if not exists revenuecat_customer_id text,
  add column if not exists revenuecat_product_id text,
  add column if not exists revenuecat_entitlement_id text,
  add column if not exists revenuecat_event_id text,
  add column if not exists provider_meta jsonb;

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  app_user_id text,
  payload jsonb not null,
  processed_at timestamp with time zone not null default now()
);

create index if not exists revenuecat_webhook_events_app_user_id_idx
  on public.revenuecat_webhook_events (app_user_id);
