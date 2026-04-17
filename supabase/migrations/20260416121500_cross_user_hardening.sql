-- Cross-user hardening for DB + storage isolation.

-- Ensure webhook/audit tables are not readable by anon/authenticated roles.
alter table if exists public.revenuecat_webhook_events enable row level security;
alter table if exists public.user_cleanup_audit enable row level security;

revoke all on table public.revenuecat_webhook_events from public, anon, authenticated;
revoke all on table public.user_cleanup_audit from public, anon, authenticated;

-- Keep explicit service_role table grants for server-side jobs/functions.
grant all on table public.revenuecat_webhook_events to service_role;
grant all on table public.user_cleanup_audit to service_role;

-- Enforce own-row access for onboarding responses when table exists.
do $$
begin
  if to_regclass('public.onboarding_responses') is not null then
    execute 'alter table public.onboarding_responses enable row level security';

    execute 'revoke all on table public.onboarding_responses from public, anon';
    execute 'grant select, insert, update on table public.onboarding_responses to authenticated';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'onboarding_responses'
        and policyname = 'onboarding_responses_select_own'
    ) then
      execute $policy$
        create policy "onboarding_responses_select_own"
        on public.onboarding_responses
        for select
        to authenticated
        using (auth.uid() = user_id)
      $policy$;
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'onboarding_responses'
        and policyname = 'onboarding_responses_insert_own'
    ) then
      execute $policy$
        create policy "onboarding_responses_insert_own"
        on public.onboarding_responses
        for insert
        to authenticated
        with check (auth.uid() = user_id)
      $policy$;
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'onboarding_responses'
        and policyname = 'onboarding_responses_update_own'
    ) then
      execute $policy$
        create policy "onboarding_responses_update_own"
        on public.onboarding_responses
        for update
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
      $policy$;
    end if;
  end if;
end;
$$;

-- Add explicit storage isolation for prayer walk map snapshots.
drop policy if exists "prayer_walk_maps_insert_own" on storage.objects;
drop policy if exists "prayer_walk_maps_select_own" on storage.objects;
drop policy if exists "prayer_walk_maps_update_own" on storage.objects;
drop policy if exists "prayer_walk_maps_delete_own" on storage.objects;

create policy "prayer_walk_maps_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'prayer-walk-maps'
  and (auth.uid())::text = (storage.foldername(name))[1]
);

create policy "prayer_walk_maps_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'prayer-walk-maps'
  and (auth.uid())::text = (storage.foldername(name))[1]
);

create policy "prayer_walk_maps_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'prayer-walk-maps'
  and (auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'prayer-walk-maps'
  and (auth.uid())::text = (storage.foldername(name))[1]
);

create policy "prayer_walk_maps_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'prayer-walk-maps'
  and (auth.uid())::text = (storage.foldername(name))[1]
);
