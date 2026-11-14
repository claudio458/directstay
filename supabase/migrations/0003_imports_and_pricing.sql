-- Phase 1 additions: listing import from PMS / MLS, own-price vs PMS-rate, location.

create type public.listing_source as enum ('manual', 'guesty', 'resales', 'inmobalia');
create type public.price_mode as enum ('own', 'pms');

alter table public.properties
  add column lat double precision,
  add column lng double precision,
  add column listing_source public.listing_source not null default 'manual',
  add column external_id text,
  add column mirror_content boolean not null default false,
  add column price_mode public.price_mode not null default 'own',
  add column source_nightly_rate numeric,
  add column source_monthly_rate numeric;

-- One DirectStay listing per remote listing per organization.
create unique index properties_external_unique on public.properties (organization_id, listing_source, external_id)
  where external_id is not null;

-- Credentials for PMS / MLS connections. Service role only (edge functions). Replaces pms_connections.
drop table if exists public.pms_connections;
create table public.integrations (
  organization_id text not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('guesty', 'resales', 'inmobalia')),
  credentials jsonb not null default '{}'::jsonb,   -- {client_id, client_secret} | {agency_id, api_key, filter_id} | {feed_url}
  access_token text,
  token_expires_at timestamptz,
  label text,
  status text not null default 'ok',
  error text,
  connected_at timestamptz not null default now(),
  last_import_at timestamptz,
  primary key (organization_id, provider)
);
alter table public.integrations enable row level security; -- no policies: secrets never reach the browser

-- What the dashboard may read: no secrets.
create view public.integrations_public with (security_invoker = false) as
  select organization_id, provider, label, status, error, connected_at, last_import_at
  from public.integrations
  where organization_id = public.my_org();
grant select on public.integrations_public to authenticated;
