-- Re-sync all iCal / PMS calendars every 15 minutes.
-- Requires the pg_cron and pg_net extensions (Database → Extensions in Supabase).
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> before running, or store the key in Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-calendars-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/sync-calendars',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb
  );
  $$
);
