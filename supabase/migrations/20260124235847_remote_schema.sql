create extension if not exists "pg_cron" with schema "pg_catalog";


  create table "public"."bookmarked_prayers" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "prayer_id" uuid not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."bookmarked_prayers" enable row level security;


  create table "public"."milestones_unlocked" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "milestone_key" text not null,
    "unlocked_at" timestamp with time zone not null default now(),
    "streak_at_unlock" integer not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."milestones_unlocked" enable row level security;


  create table "public"."prayer_attachments" (
    "id" uuid not null default gen_random_uuid(),
    "prayer_id" uuid not null,
    "user_id" uuid not null,
    "storage_bucket" text not null default 'prayer-attachments'::text,
    "storage_path" text not null,
    "mime_type" text,
    "file_size_bytes" bigint,
    "caption" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."prayer_attachments" enable row level security;


  create table "public"."prayers" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "prayed_at" timestamp with time zone not null default now(),
    "audio_path" text,
    "transcript_text" text,
    "duration_seconds" integer,
    "archived" boolean default false,
    "expires_at" timestamp with time zone default (now() + '60 days'::interval),
    "created_at" timestamp with time zone default now(),
    "is_premium" boolean default false,
    "reminder_sent" boolean default false,
    "deleted_at" timestamp with time zone,
    "entry_source" text default 'audio'::text,
    "bible_reference" text,
    "bible_version" text,
    "bible_provider" text,
    "bible_added_at" timestamp with time zone,
    "location_name" text
      );


alter table "public"."prayers" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "plan_tier" text not null default 'free'::text,
    "reminder_time" time without time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."reflections" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "type" text not null,
    "title" text not null,
    "subtitle" text,
    "body" text not null,
    "verse_text" text,
    "verse_reference" text,
    "week_key" text,
    "month_key" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."reflections" enable row level security;


  create table "public"."subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "stripe_customer_id" text,
    "stripe_subscription_id" text,
    "plan" text,
    "status" text,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."subscriptions" enable row level security;


  create table "public"."user_settings" (
    "user_id" uuid not null,
    "dark_mode_preference" text default 'system'::text,
    "notifications_enabled" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "daily_reminder_enabled" boolean default false,
    "reminder_time" text default '07:00'::text,
    "delete_audio_after_transcription" boolean default false,
    "subscription_plan" text default 'core'::text,
    "version" text default '1.0.0'::text
      );


alter table "public"."user_settings" enable row level security;


  create table "public"."user_stats" (
    "user_id" uuid not null,
    "current_streak" integer default 0,
    "longest_streak" integer default 0,
    "last_prayer_date" date,
    "prayers_this_month" integer default 0,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."user_stats" enable row level security;

CREATE UNIQUE INDEX bookmarked_prayers_pkey ON public.bookmarked_prayers USING btree (id);

CREATE UNIQUE INDEX bookmarked_prayers_user_id_prayer_id_key ON public.bookmarked_prayers USING btree (user_id, prayer_id);

CREATE INDEX idx_milestones_unlocked_user ON public.milestones_unlocked USING btree (user_id);

CREATE INDEX idx_milestones_unlocked_user_created ON public.milestones_unlocked USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX milestones_unlocked_pkey ON public.milestones_unlocked USING btree (id);

CREATE UNIQUE INDEX milestones_unlocked_unique_user_milestone ON public.milestones_unlocked USING btree (user_id, milestone_key);

CREATE UNIQUE INDEX prayer_attachments_pkey ON public.prayer_attachments USING btree (id);

CREATE INDEX prayer_attachments_prayer_id_idx ON public.prayer_attachments USING btree (prayer_id);

CREATE INDEX prayer_attachments_user_id_idx ON public.prayer_attachments USING btree (user_id);

CREATE INDEX prayers_expires_at_idx ON public.prayers USING btree (expires_at);

CREATE UNIQUE INDEX prayers_pkey ON public.prayers USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE INDEX reflections_month_key_idx ON public.reflections USING btree (month_key);

CREATE UNIQUE INDEX reflections_pkey ON public.reflections USING btree (id);

CREATE INDEX reflections_user_type_idx ON public.reflections USING btree (user_id, type);

CREATE INDEX reflections_week_key_idx ON public.reflections USING btree (week_key);

CREATE UNIQUE INDEX settings_pkey ON public.user_settings USING btree (user_id);

CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);

CREATE UNIQUE INDEX user_settings_user_id_key ON public.user_settings USING btree (user_id);

CREATE UNIQUE INDEX user_settings_user_id_unique ON public.user_settings USING btree (user_id);

CREATE UNIQUE INDEX user_stats_pkey ON public.user_stats USING btree (user_id);

alter table "public"."bookmarked_prayers" add constraint "bookmarked_prayers_pkey" PRIMARY KEY using index "bookmarked_prayers_pkey";

alter table "public"."milestones_unlocked" add constraint "milestones_unlocked_pkey" PRIMARY KEY using index "milestones_unlocked_pkey";

alter table "public"."prayer_attachments" add constraint "prayer_attachments_pkey" PRIMARY KEY using index "prayer_attachments_pkey";

alter table "public"."prayers" add constraint "prayers_pkey" PRIMARY KEY using index "prayers_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."reflections" add constraint "reflections_pkey" PRIMARY KEY using index "reflections_pkey";

alter table "public"."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY using index "subscriptions_pkey";

alter table "public"."user_settings" add constraint "settings_pkey" PRIMARY KEY using index "settings_pkey";

alter table "public"."user_stats" add constraint "user_stats_pkey" PRIMARY KEY using index "user_stats_pkey";

alter table "public"."bookmarked_prayers" add constraint "bookmarked_prayers_prayer_id_fkey" FOREIGN KEY (prayer_id) REFERENCES public.prayers(id) ON DELETE CASCADE not valid;

alter table "public"."bookmarked_prayers" validate constraint "bookmarked_prayers_prayer_id_fkey";

alter table "public"."bookmarked_prayers" add constraint "bookmarked_prayers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."bookmarked_prayers" validate constraint "bookmarked_prayers_user_id_fkey";

alter table "public"."bookmarked_prayers" add constraint "bookmarked_prayers_user_id_prayer_id_key" UNIQUE using index "bookmarked_prayers_user_id_prayer_id_key";

alter table "public"."milestones_unlocked" add constraint "milestones_unlocked_unique_user_milestone" UNIQUE using index "milestones_unlocked_unique_user_milestone";

alter table "public"."milestones_unlocked" add constraint "milestones_unlocked_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."milestones_unlocked" validate constraint "milestones_unlocked_user_id_fkey";

alter table "public"."prayer_attachments" add constraint "prayer_attachments_prayer_id_fkey" FOREIGN KEY (prayer_id) REFERENCES public.prayers(id) ON DELETE CASCADE not valid;

alter table "public"."prayer_attachments" validate constraint "prayer_attachments_prayer_id_fkey";

alter table "public"."prayers" add constraint "prayers_entry_source_check" CHECK ((entry_source = ANY (ARRAY['audio'::text, 'text'::text, 'ocr'::text]))) not valid;

alter table "public"."prayers" validate constraint "prayers_entry_source_check";

alter table "public"."prayers" add constraint "prayers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."prayers" validate constraint "prayers_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."reflections" add constraint "reflections_type_check" CHECK ((type = ANY (ARRAY['weekly'::text, 'monthly'::text]))) not valid;

alter table "public"."reflections" validate constraint "reflections_type_check";

alter table "public"."reflections" add constraint "reflections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."reflections" validate constraint "reflections_user_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

alter table "public"."user_settings" add constraint "fk_user_settings_user" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."user_settings" validate constraint "fk_user_settings_user";

alter table "public"."user_settings" add constraint "settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_settings" validate constraint "settings_user_id_fkey";

alter table "public"."user_settings" add constraint "user_settings_user_id_key" UNIQUE using index "user_settings_user_id_key";

alter table "public"."user_settings" add constraint "user_settings_user_id_unique" UNIQUE using index "user_settings_user_id_unique";

alter table "public"."user_stats" add constraint "user_stats_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_stats" validate constraint "user_stats_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_user_and_settings()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- Delete from user_settings first
  delete from user_settings where user_id = auth.uid();

  -- Delete the user from auth.users
  delete from auth.users where id = auth.uid();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_streak(uid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    streak int := 0;
    last_date date := null;
    row_date date;
begin
    -- Loop through all prayer dates in descending order
    for row_date in
        select prayed_at::date
        from prayers
        where user_id = uid
        order by prayed_at desc
    loop
        
        -- first record
        if last_date is null then
            -- If first prayer is today or yesterday, start streak
            if row_date = current_date or row_date = current_date - interval '1 day' then
                streak := streak + 1;
                last_date := row_date;
            else
                return 0; -- streak broken
            end if;

        else
            -- For subsequent records: must be exactly 1 day apart
            if row_date = last_date - interval '1 day' then
                streak := streak + 1;
                last_date := row_date;
            else
                exit; -- streak ends
            end if;
        end if;

    end loop;

    return streak;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- profiles
  insert into public.profiles (id, plan_tier)
  values (new.id, 'free')
  on conflict do nothing;

  -- user settings
  insert into public.user_settings (
    user_id,
    dark_mode_preference,
    notifications_enabled,
    daily_reminder_enabled,
    reminder_time,
    delete_audio_after_transcription,
    subscription_plan,
    version
  )
  values (
    new.id,
    'system',
    true,
    false,
    '07:00',
    false,
    'core',
    '1.0.0'
  )
  on conflict do nothing;

  -- user stats
  insert into public.user_stats (
    user_id,
    current_streak,
    longest_streak,
    prayers_this_month
  )
  values (new.id, 0, 0, 0)
  on conflict do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_user_stats(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_last_prayer_date date;
  v_current_streak int := 0;
  v_longest_streak int := 0;
  v_prayers_this_month int := 0;

  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := ((now() at time zone 'utc')::date - 1);
begin
  -- Ensure a row exists (safe if it already exists)
  insert into public.user_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Last prayer date (UTC)
  select max((prayed_at at time zone 'utc')::date)
  into v_last_prayer_date
  from public.prayers
  where user_id = p_user_id
    and deleted_at is null;

  -- Prayers this month (count distinct prayer-days in current UTC month)
  select count(*)::int
  into v_prayers_this_month
  from (
    select distinct (prayed_at at time zone 'utc')::date as prayer_day
    from public.prayers
    where user_id = p_user_id
      and deleted_at is null
      and date_trunc('month', prayed_at at time zone 'utc') = date_trunc('month', now() at time zone 'utc')
  ) m;

  -- Longest streak (gaps-and-islands over distinct prayer days)
  with days as (
    select distinct (prayed_at at time zone 'utc')::date as prayer_day
    from public.prayers
    where user_id = p_user_id
      and deleted_at is null
  ),
  ordered as (
    select
      prayer_day,
      row_number() over (order by prayer_day)::int as rn
    from days
  ),
  islands as (
    -- date - int is valid
    select (prayer_day - rn) as grp
    from ordered
  ),
  counts as (
    select grp, count(*)::int as cnt
    from islands
    group by grp
  )
  select coalesce(max(cnt), 0)::int
  into v_longest_streak
  from counts;

  -- Current streak (matches your Journal logic: today OR yesterday anchors it)
  if v_last_prayer_date is null then
    v_current_streak := 0;
  elsif v_last_prayer_date = v_today then
    -- count backwards starting today
    with days as (
      select distinct (prayed_at at time zone 'utc')::date as prayer_day
      from public.prayers
      where user_id = p_user_id
        and deleted_at is null
    ),
    seq as (
      select
        prayer_day,
        row_number() over (order by prayer_day desc)::int as rn_desc
      from days
      where prayer_day <= v_today
    ),
    matched as (
      select (prayer_day = (v_today - (rn_desc - 1))) as is_match
      from seq
    ),
    streak as (
      select count(*)::int as cnt
      from matched
      where is_match = true
    )
    select coalesce(cnt, 0) into v_current_streak from streak;

  elsif v_last_prayer_date = v_yesterday then
    -- count backwards starting yesterday
    with days as (
      select distinct (prayed_at at time zone 'utc')::date as prayer_day
      from public.prayers
      where user_id = p_user_id
        and deleted_at is null
    ),
    seq as (
      select
        prayer_day,
        row_number() over (order by prayer_day desc)::int as rn_desc
      from days
      where prayer_day <= v_yesterday
    ),
    matched as (
      select (prayer_day = (v_yesterday - (rn_desc - 1))) as is_match
      from seq
    ),
    streak as (
      select count(*)::int as cnt
      from matched
      where is_match = true
    )
    select coalesce(cnt, 0) into v_current_streak from streak;

  else
    v_current_streak := 0;
  end if;

  update public.user_stats us
  set
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_prayer_date = v_last_prayer_date,
    prayers_this_month = v_prayers_this_month,
    updated_at = now()
  where us.user_id = p_user_id;

end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_recompute_user_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Recompute for the affected user(s)
  if (tg_op = 'INSERT') then
    perform public.recompute_user_stats(new.user_id);
    return new;
  elsif (tg_op = 'DELETE') then
    perform public.recompute_user_stats(old.user_id);
    return old;
  else
    -- UPDATE: if user_id changed, recompute both sides
    if new.user_id is distinct from old.user_id then
      perform public.recompute_user_stats(old.user_id);
      perform public.recompute_user_stats(new.user_id);
    else
      perform public.recompute_user_stats(new.user_id);
    end if;
    return new;
  end if;
end;
$function$
;

grant delete on table "public"."bookmarked_prayers" to "anon";

grant insert on table "public"."bookmarked_prayers" to "anon";

grant references on table "public"."bookmarked_prayers" to "anon";

grant select on table "public"."bookmarked_prayers" to "anon";

grant trigger on table "public"."bookmarked_prayers" to "anon";

grant truncate on table "public"."bookmarked_prayers" to "anon";

grant update on table "public"."bookmarked_prayers" to "anon";

grant delete on table "public"."bookmarked_prayers" to "authenticated";

grant insert on table "public"."bookmarked_prayers" to "authenticated";

grant references on table "public"."bookmarked_prayers" to "authenticated";

grant select on table "public"."bookmarked_prayers" to "authenticated";

grant trigger on table "public"."bookmarked_prayers" to "authenticated";

grant truncate on table "public"."bookmarked_prayers" to "authenticated";

grant update on table "public"."bookmarked_prayers" to "authenticated";

grant delete on table "public"."bookmarked_prayers" to "service_role";

grant insert on table "public"."bookmarked_prayers" to "service_role";

grant references on table "public"."bookmarked_prayers" to "service_role";

grant select on table "public"."bookmarked_prayers" to "service_role";

grant trigger on table "public"."bookmarked_prayers" to "service_role";

grant truncate on table "public"."bookmarked_prayers" to "service_role";

grant update on table "public"."bookmarked_prayers" to "service_role";

grant delete on table "public"."milestones_unlocked" to "anon";

grant insert on table "public"."milestones_unlocked" to "anon";

grant references on table "public"."milestones_unlocked" to "anon";

grant select on table "public"."milestones_unlocked" to "anon";

grant trigger on table "public"."milestones_unlocked" to "anon";

grant truncate on table "public"."milestones_unlocked" to "anon";

grant update on table "public"."milestones_unlocked" to "anon";

grant delete on table "public"."milestones_unlocked" to "authenticated";

grant insert on table "public"."milestones_unlocked" to "authenticated";

grant references on table "public"."milestones_unlocked" to "authenticated";

grant select on table "public"."milestones_unlocked" to "authenticated";

grant trigger on table "public"."milestones_unlocked" to "authenticated";

grant truncate on table "public"."milestones_unlocked" to "authenticated";

grant update on table "public"."milestones_unlocked" to "authenticated";

grant delete on table "public"."milestones_unlocked" to "service_role";

grant insert on table "public"."milestones_unlocked" to "service_role";

grant references on table "public"."milestones_unlocked" to "service_role";

grant select on table "public"."milestones_unlocked" to "service_role";

grant trigger on table "public"."milestones_unlocked" to "service_role";

grant truncate on table "public"."milestones_unlocked" to "service_role";

grant update on table "public"."milestones_unlocked" to "service_role";

grant delete on table "public"."prayer_attachments" to "anon";

grant insert on table "public"."prayer_attachments" to "anon";

grant references on table "public"."prayer_attachments" to "anon";

grant select on table "public"."prayer_attachments" to "anon";

grant trigger on table "public"."prayer_attachments" to "anon";

grant truncate on table "public"."prayer_attachments" to "anon";

grant update on table "public"."prayer_attachments" to "anon";

grant delete on table "public"."prayer_attachments" to "authenticated";

grant insert on table "public"."prayer_attachments" to "authenticated";

grant references on table "public"."prayer_attachments" to "authenticated";

grant select on table "public"."prayer_attachments" to "authenticated";

grant trigger on table "public"."prayer_attachments" to "authenticated";

grant truncate on table "public"."prayer_attachments" to "authenticated";

grant update on table "public"."prayer_attachments" to "authenticated";

grant delete on table "public"."prayer_attachments" to "service_role";

grant insert on table "public"."prayer_attachments" to "service_role";

grant references on table "public"."prayer_attachments" to "service_role";

grant select on table "public"."prayer_attachments" to "service_role";

grant trigger on table "public"."prayer_attachments" to "service_role";

grant truncate on table "public"."prayer_attachments" to "service_role";

grant update on table "public"."prayer_attachments" to "service_role";

grant delete on table "public"."prayers" to "anon";

grant insert on table "public"."prayers" to "anon";

grant references on table "public"."prayers" to "anon";

grant select on table "public"."prayers" to "anon";

grant trigger on table "public"."prayers" to "anon";

grant truncate on table "public"."prayers" to "anon";

grant update on table "public"."prayers" to "anon";

grant delete on table "public"."prayers" to "authenticated";

grant insert on table "public"."prayers" to "authenticated";

grant references on table "public"."prayers" to "authenticated";

grant select on table "public"."prayers" to "authenticated";

grant trigger on table "public"."prayers" to "authenticated";

grant truncate on table "public"."prayers" to "authenticated";

grant update on table "public"."prayers" to "authenticated";

grant delete on table "public"."prayers" to "service_role";

grant insert on table "public"."prayers" to "service_role";

grant references on table "public"."prayers" to "service_role";

grant select on table "public"."prayers" to "service_role";

grant trigger on table "public"."prayers" to "service_role";

grant truncate on table "public"."prayers" to "service_role";

grant update on table "public"."prayers" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."reflections" to "anon";

grant insert on table "public"."reflections" to "anon";

grant references on table "public"."reflections" to "anon";

grant select on table "public"."reflections" to "anon";

grant trigger on table "public"."reflections" to "anon";

grant truncate on table "public"."reflections" to "anon";

grant update on table "public"."reflections" to "anon";

grant delete on table "public"."reflections" to "authenticated";

grant insert on table "public"."reflections" to "authenticated";

grant references on table "public"."reflections" to "authenticated";

grant select on table "public"."reflections" to "authenticated";

grant trigger on table "public"."reflections" to "authenticated";

grant truncate on table "public"."reflections" to "authenticated";

grant update on table "public"."reflections" to "authenticated";

grant delete on table "public"."reflections" to "service_role";

grant insert on table "public"."reflections" to "service_role";

grant references on table "public"."reflections" to "service_role";

grant select on table "public"."reflections" to "service_role";

grant trigger on table "public"."reflections" to "service_role";

grant truncate on table "public"."reflections" to "service_role";

grant update on table "public"."reflections" to "service_role";

grant delete on table "public"."subscriptions" to "anon";

grant insert on table "public"."subscriptions" to "anon";

grant references on table "public"."subscriptions" to "anon";

grant select on table "public"."subscriptions" to "anon";

grant trigger on table "public"."subscriptions" to "anon";

grant truncate on table "public"."subscriptions" to "anon";

grant update on table "public"."subscriptions" to "anon";

grant delete on table "public"."subscriptions" to "authenticated";

grant insert on table "public"."subscriptions" to "authenticated";

grant references on table "public"."subscriptions" to "authenticated";

grant select on table "public"."subscriptions" to "authenticated";

grant trigger on table "public"."subscriptions" to "authenticated";

grant truncate on table "public"."subscriptions" to "authenticated";

grant update on table "public"."subscriptions" to "authenticated";

grant delete on table "public"."subscriptions" to "service_role";

grant insert on table "public"."subscriptions" to "service_role";

grant references on table "public"."subscriptions" to "service_role";

grant select on table "public"."subscriptions" to "service_role";

grant trigger on table "public"."subscriptions" to "service_role";

grant truncate on table "public"."subscriptions" to "service_role";

grant update on table "public"."subscriptions" to "service_role";

grant delete on table "public"."user_settings" to "anon";

grant insert on table "public"."user_settings" to "anon";

grant references on table "public"."user_settings" to "anon";

grant select on table "public"."user_settings" to "anon";

grant trigger on table "public"."user_settings" to "anon";

grant truncate on table "public"."user_settings" to "anon";

grant update on table "public"."user_settings" to "anon";

grant delete on table "public"."user_settings" to "authenticated";

grant insert on table "public"."user_settings" to "authenticated";

grant references on table "public"."user_settings" to "authenticated";

grant select on table "public"."user_settings" to "authenticated";

grant trigger on table "public"."user_settings" to "authenticated";

grant truncate on table "public"."user_settings" to "authenticated";

grant update on table "public"."user_settings" to "authenticated";

grant delete on table "public"."user_settings" to "service_role";

grant insert on table "public"."user_settings" to "service_role";

grant references on table "public"."user_settings" to "service_role";

grant select on table "public"."user_settings" to "service_role";

grant trigger on table "public"."user_settings" to "service_role";

grant truncate on table "public"."user_settings" to "service_role";

grant update on table "public"."user_settings" to "service_role";

grant delete on table "public"."user_stats" to "anon";

grant insert on table "public"."user_stats" to "anon";

grant references on table "public"."user_stats" to "anon";

grant select on table "public"."user_stats" to "anon";

grant trigger on table "public"."user_stats" to "anon";

grant truncate on table "public"."user_stats" to "anon";

grant update on table "public"."user_stats" to "anon";

grant delete on table "public"."user_stats" to "authenticated";

grant insert on table "public"."user_stats" to "authenticated";

grant references on table "public"."user_stats" to "authenticated";

grant select on table "public"."user_stats" to "authenticated";

grant trigger on table "public"."user_stats" to "authenticated";

grant truncate on table "public"."user_stats" to "authenticated";

grant update on table "public"."user_stats" to "authenticated";

grant delete on table "public"."user_stats" to "service_role";

grant insert on table "public"."user_stats" to "service_role";

grant references on table "public"."user_stats" to "service_role";

grant select on table "public"."user_stats" to "service_role";

grant trigger on table "public"."user_stats" to "service_role";

grant truncate on table "public"."user_stats" to "service_role";

grant update on table "public"."user_stats" to "service_role";


  create policy "Users bookmark prayers"
  on "public"."bookmarked_prayers"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users read their own bookmarks"
  on "public"."bookmarked_prayers"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users unbookmark prayers"
  on "public"."bookmarked_prayers"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can insert their own milestones"
  on "public"."milestones_unlocked"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "Users can select their own milestones"
  on "public"."milestones_unlocked"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "attachments_delete_own"
  on "public"."prayer_attachments"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "attachments_insert_own"
  on "public"."prayer_attachments"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "attachments_select_own"
  on "public"."prayer_attachments"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "attachments_update_own"
  on "public"."prayer_attachments"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can insert own prayers"
  on "public"."prayers"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can update own prayers"
  on "public"."prayers"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can view own prayers"
  on "public"."prayers"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "prayers_delete_own"
  on "public"."prayers"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "prayers_insert_own"
  on "public"."prayers"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "prayers_select_own"
  on "public"."prayers"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "prayers_update_own"
  on "public"."prayers"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = id));



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((auth.uid() = id));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((auth.uid() = id))
with check ((auth.uid() = id));



  create policy "Users can delete their own reflections"
  on "public"."reflections"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can insert their own reflections"
  on "public"."reflections"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can select their own reflections"
  on "public"."reflections"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can update their own reflections"
  on "public"."reflections"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "subscriptions_insert_own"
  on "public"."subscriptions"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "subscriptions_select_own"
  on "public"."subscriptions"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "subscriptions_update_own"
  on "public"."subscriptions"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "user_settings_delete_own"
  on "public"."user_settings"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "user_settings_insert_own"
  on "public"."user_settings"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "user_settings_select_own"
  on "public"."user_settings"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "user_settings_update_own"
  on "public"."user_settings"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "user_stats_insert_own"
  on "public"."user_stats"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "user_stats_select_own"
  on "public"."user_stats"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "user_stats_update_own"
  on "public"."user_stats"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


CREATE TRIGGER trg_prayers_recompute_user_stats AFTER INSERT OR DELETE OR UPDATE ON public.prayers FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_user_stats();

CREATE TRIGGER trg_recompute_user_stats_on_prayers AFTER INSERT OR DELETE OR UPDATE ON public.prayers FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_user_stats();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "attachments_delete_own_folder"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'prayer-attachments'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



  create policy "attachments_insert_own_folder"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'prayer-attachments'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



  create policy "attachments_select_own_folder"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'prayer-attachments'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



  create policy "attachments_update_own_folder"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'prayer-attachments'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])))
with check (((bucket_id = 'prayer-attachments'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



  create policy "prayer_audio_delete_own"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'prayer-audio'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "prayer_audio_insert_own"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'prayer-audio'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "prayer_audio_read_own"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'prayer-audio'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "prayer_audio_update_own"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'prayer-audio'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
with check (((bucket_id = 'prayer-audio'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



