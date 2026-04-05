begin;

alter table if exists public.subscriptions
  add column if not exists access_override boolean not null default false,
  add column if not exists access_override_reason text,
  add column if not exists access_override_expires_at timestamp with time zone;

create index if not exists subscriptions_access_override_idx
  on public.subscriptions (access_override, access_override_expires_at);

commit;
