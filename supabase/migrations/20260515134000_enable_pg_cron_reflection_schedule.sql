create extension if not exists pg_cron;

do $$
begin
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
end;
$$;
