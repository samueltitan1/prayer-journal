-- Safe cleanup for stale, unconfirmed onboarding users.

create table if not exists public.user_cleanup_audit (
  id bigserial primary key,
  user_id uuid not null,
  email text,
  reason text not null,
  dry_run boolean not null default true,
  deleted boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists user_cleanup_audit_user_created_idx
  on public.user_cleanup_audit (user_id, created_at desc);

create index if not exists user_cleanup_audit_created_idx
  on public.user_cleanup_audit (created_at desc);

create or replace function public.cleanup_stale_unconfirmed_users(
  p_dry_run boolean default true,
  p_older_than_days integer default 30,
  p_limit integer default 200
)
returns table(user_id uuid, email text, action text, reason text)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  cutoff_at timestamp with time zone := now() - make_interval(days => greatest(p_older_than_days, 1));
  max_rows integer := greatest(p_limit, 1);
  candidate record;
  action_taken text;
  fixed_reason text := 'stale_unconfirmed_no_activity_no_entitlement';
begin
  for candidate in
    select
      u.id as uid,
      u.email as email_addr
    from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < cutoff_at
      and not exists (
        select 1
        from public.subscriptions s
        where s.user_id = u.id
          and s.status in ('active', 'trialing')
      )
      and not exists (
        select 1
        from public.prayers p
        where p.user_id = u.id
          and p.deleted_at is null
      )
    order by u.created_at asc
    limit max_rows
  loop
    action_taken := case when p_dry_run then 'dry_run' else 'deleted' end;

    insert into public.user_cleanup_audit (user_id, email, reason, dry_run, deleted)
    values (candidate.uid, candidate.email_addr, fixed_reason, p_dry_run, not p_dry_run);

    if not p_dry_run then
      delete from auth.users
      where id = candidate.uid;
    end if;

    user_id := candidate.uid;
    email := candidate.email_addr;
    action := action_taken;
    reason := fixed_reason;
    return next;
  end loop;

  return;
end;
$$;

revoke execute on function public.cleanup_stale_unconfirmed_users(boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_stale_unconfirmed_users(boolean, integer, integer)
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (
      select 1
      from cron.job
      where jobname = 'cleanup_stale_unconfirmed_users_dryrun_daily'
    ) then
      perform cron.schedule(
        'cleanup_stale_unconfirmed_users_dryrun_daily',
        '15 3 * * *',
        $$select * from public.cleanup_stale_unconfirmed_users(true, 30, 200);$$
      );
    end if;
  end if;
end;
$$;
