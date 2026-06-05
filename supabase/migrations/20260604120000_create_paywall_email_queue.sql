create table paywall_email_queue (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  email        text not null,
  first_name   text not null,
  send_after   timestamptz not null,
  sent_at      timestamptz,
  suppressed   boolean default false,
  created_at   timestamptz default now(),
  unique(user_id)
);
