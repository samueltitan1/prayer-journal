begin;

-- 1) Server-managed entitlements: prevent client-side writes.
revoke insert, update, delete, truncate, references, trigger
on table public.subscriptions
from anon, authenticated;

revoke select on table public.subscriptions from anon;
grant select on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.subscriptions to service_role;

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
drop policy if exists "subscriptions_update_own" on public.subscriptions;
drop policy if exists "subscriptions_delete_own" on public.subscriptions;
drop policy if exists "subscriptions_insert_own_mobile_only" on public.subscriptions;
drop policy if exists "subscriptions_update_own_mobile_only" on public.subscriptions;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.subscriptions', p.policyname);
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'subscriptions_select_own'
  ) then
    execute $policy$
      create policy "subscriptions_select_own"
      on public.subscriptions
      as permissive
      for select
      to authenticated
      using (auth.uid() = user_id)
    $policy$;
  end if;
end;
$$;

create unique index if not exists subscriptions_user_id_key
  on public.subscriptions (user_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'status'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_status_allowed_chk'
  ) then
    execute $sql$
      alter table public.subscriptions
      add constraint subscriptions_status_allowed_chk
      check (
        status is null
        or status in ('active', 'trialing', 'past_due', 'canceled', 'expired', 'incomplete')
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'plan'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_plan_allowed_chk'
  ) then
    execute $sql$
      alter table public.subscriptions
      add constraint subscriptions_plan_allowed_chk
      check (
        plan is null
        or plan in ('free', 'monthly', 'yearly', 'lifetime', 'unknown')
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'provider'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_provider_allowed_chk'
  ) then
    execute $sql$
      alter table public.subscriptions
      add constraint subscriptions_provider_allowed_chk
      check (
        provider is null
        or provider in ('apple', 'google', 'stripe')
      )
    $sql$;
  end if;
end;
$$;

-- 2) RPC hardening + search_path for SECURITY DEFINER routines.
create or replace function public.get_user_streak(uid uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  caller_uid uuid := auth.uid();
  target_uid uuid := coalesce(uid, auth.uid());
  streak int := 0;
  last_date date := null;
  row_date date;
begin
  if caller_uid is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if target_uid is distinct from caller_uid then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  for row_date in
    select prayed_at::date
    from public.prayers
    where user_id = caller_uid
      and deleted_at is null
    order by prayed_at desc
  loop
    if last_date is null then
      if row_date = current_date or row_date = current_date - interval '1 day' then
        streak := streak + 1;
        last_date := row_date;
      else
        return 0;
      end if;
    else
      if row_date = last_date - interval '1 day' then
        streak := streak + 1;
        last_date := row_date;
      else
        exit;
      end if;
    end if;
  end loop;

  return streak;
end;
$function$;

alter function public.delete_user_and_settings() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.recompute_user_stats(uuid) set search_path = public;
alter function public.tg_recompute_user_stats() set search_path = public;

revoke execute on function public.get_user_streak(uuid) from public, anon;
grant execute on function public.get_user_streak(uuid) to authenticated;

revoke execute on function public.delete_user_and_settings() from public, anon;
grant execute on function public.delete_user_and_settings() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.recompute_user_stats(uuid) from public, anon, authenticated;
revoke execute on function public.tg_recompute_user_stats() from public, anon, authenticated;

commit;
