create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists http with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname in ('send_paywall_email_every_5m', 'send-paywall-emails');

select cron.schedule(
  'send-paywall-emails',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://joafnrfdculytbvbghgg.functions.supabase.co/send-paywall-email',
      headers := '{"Content-Type":"application/json","x-supabase-scheduled":"true"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
