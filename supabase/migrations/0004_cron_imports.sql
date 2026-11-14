-- Re-import content and rates from every connected PMS / MLS once per night (03:00 UTC).
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY>.
select cron.schedule(
  'pms-import-nightly',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/pms-import',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'),
    body := '{"action":"refresh_all"}'::jsonb
  );
  $$
);
