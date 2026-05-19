alter table public.prayers
  add column if not exists themes text[];

create index if not exists prayers_themes_gin_idx
  on public.prayers using gin (themes);

alter table public.user_settings
  add column if not exists last_reflection_sent_at timestamp with time zone,
  add column if not exists reflection_sent_count_week integer not null default 0,
  add column if not exists reflection_sent_week_key text,
  add column if not exists last_active_at timestamp with time zone,
  add column if not exists timezone text;

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  timezone text,
  last_seen_at timestamp with time zone not null default now(),
  disabled_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists user_push_tokens_user_id_idx
  on public.user_push_tokens (user_id);

create index if not exists user_push_tokens_active_idx
  on public.user_push_tokens (user_id, disabled_at, last_seen_at desc);

alter table public.user_push_tokens enable row level security;

grant select, insert, update, delete on public.user_push_tokens to authenticated;
grant all on public.user_push_tokens to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_push_tokens'
      and policyname = 'Users can manage their own push tokens'
  ) then
    create policy "Users can manage their own push tokens"
      on public.user_push_tokens
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.tg_touch_user_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_push_tokens_set_updated_at on public.user_push_tokens;
create trigger user_push_tokens_set_updated_at
before update on public.user_push_tokens
for each row
execute function public.tg_touch_user_push_tokens_updated_at();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    if not exists (
      select 1
      from cron.job
      where jobname = 'send_reflection_notifications_daily'
    ) then
      perform cron.schedule(
        'send_reflection_notifications_daily',
        '10 13 * * *',
        $job$
          select net.http_post(
            url := 'https://joafnrfdculytbvbghgg.functions.supabase.co/send_reflection_notifications',
            headers := '{"Content-Type":"application/json","x-supabase-scheduled":"true"}'::jsonb,
            body := '{}'::jsonb
          );
        $job$
      );
    end if;
  end if;
end;
$$;
