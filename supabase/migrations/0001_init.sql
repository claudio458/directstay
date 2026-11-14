-- DirectStay Exchange: core schema
-- Run in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type public.account_type as enum ('agency', 'private');
create type public.user_role as enum ('agent', 'owner', 'admin');
create type public.property_type as enum ('apartment', 'studio', 'house', 'villa', 'chalet');
create type public.visibility as enum ('public', 'network');
create type public.property_status as enum ('draft', 'published', 'paused');
create type public.calendar_source as enum ('ical', 'pms', 'manual');
create type public.sync_status as enum ('ok', 'error', 'pending', 'never');
create type public.inquiry_status as enum ('new', 'replied', 'closed');

-- ---------- Tables ----------
create table public.regions (
  id text primary key default gen_random_uuid()::text,
  slug text unique not null,
  name text not null,
  country text not null,
  image text,
  blurb text
);

create table public.organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  type public.account_type not null default 'agency',
  city text,
  country text,
  verified boolean not null default false,
  email text not null,
  phone text,
  website text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'agent',
  organization_id text not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.properties (
  id text primary key default gen_random_uuid()::text,
  slug text unique not null,
  organization_id text not null references public.organizations(id) on delete cascade,
  region_id text not null references public.regions(id),
  title text not null,
  city text not null default '',
  area text,
  type public.property_type not null default 'apartment',
  size_m2 int,
  bedrooms int not null default 1,
  bathrooms int not null default 1,
  max_guests int not null default 2,
  min_months int not null default 1 check (min_months between 1 and 24),
  max_months int not null default 12 check (max_months >= min_months),
  monthly_price numeric,
  utilities_included boolean not null default true,
  agent_commission_pct numeric check (agent_commission_pct between 0 and 50),
  description text not null default '',
  amenities text[] not null default '{}',
  photos text[] not null default '{}',
  visibility public.visibility not null default 'public',
  status public.property_status not null default 'draft',
  -- calendar source
  calendar_type public.calendar_source not null default 'manual',
  ical_url text,
  pms_provider text,
  pms_listing_id text,
  last_synced_at timestamptz,
  sync_status public.sync_status not null default 'never',
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.properties (region_id, status);
create index on public.properties (organization_id);

-- Busy periods. end_date is exclusive (checkout day).
create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date > start_date),
  source public.calendar_source not null default 'manual',
  external_uid text,
  summary text,
  created_at timestamptz not null default now()
);
create index on public.availability_blocks (property_id, start_date);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  from_name text not null,
  from_email text not null,
  from_phone text,
  from_organization_id text references public.organizations(id) on delete set null,
  on_behalf_of_client boolean not null default false,
  move_in date not null,
  months int not null,
  guests int not null default 1,
  message text not null default '',
  status public.inquiry_status not null default 'new',
  created_at timestamptz not null default now()
);
create index on public.inquiries (property_id);

-- Per-organization PMS credentials. Only readable by the service role (edge functions).
create table public.pms_connections (
  organization_id text not null references public.organizations(id) on delete cascade,
  provider text not null,
  client_id text,
  client_secret text,
  access_token text,
  token_expires_at timestamptz,
  primary key (organization_id, provider)
);

-- ---------- Helpers ----------
create or replace function public.my_org() returns text
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger properties_touch before update on public.properties for each row execute function public.touch_updated_at();

-- Create organization + profile when a user signs up (metadata comes from the sign-up form).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  org_id text;
begin
  insert into public.organizations (name, type, city, country, email, phone)
  values (
    coalesce(nullif(m->>'org_name', ''), m->>'full_name', new.email),
    coalesce((m->>'org_type')::public.account_type, 'agency'),
    m->>'city', m->>'country', new.email, m->>'phone'
  ) returning id into org_id;
  insert into public.profiles (id, email, full_name, role, organization_id)
  values (new.id, new.email, coalesce(m->>'full_name', ''), coalesce((m->>'role')::public.user_role, 'agent'), org_id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- Row level security ----------
alter table public.regions enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.inquiries enable row level security;
alter table public.pms_connections enable row level security; -- no policies: service role only

create policy "regions readable" on public.regions for select using (true);

-- Organizations: names are public; contact details are hidden in the UI for anonymous users.
-- (Hardening for production: expose a public view without email/phone and restrict the table to authenticated.)
create policy "orgs readable" on public.organizations for select using (true);
create policy "orgs editable by members" on public.organizations for update using (id = public.my_org());

create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());

create policy "published public listings" on public.properties for select using (
  (status = 'published' and (visibility = 'public' or auth.uid() is not null))
  or organization_id = public.my_org()
);
create policy "insert own listings" on public.properties for insert with check (organization_id = public.my_org());
create policy "update own listings" on public.properties for update using (organization_id = public.my_org());
create policy "delete own listings" on public.properties for delete using (organization_id = public.my_org());

create policy "blocks readable with listing" on public.availability_blocks for select using (
  exists (select 1 from public.properties p where p.id = property_id)
);
create policy "manage own blocks" on public.availability_blocks for all using (
  exists (select 1 from public.properties p where p.id = property_id and p.organization_id = public.my_org())
) with check (
  exists (select 1 from public.properties p where p.id = property_id and p.organization_id = public.my_org())
);

create policy "anyone can send inquiry" on public.inquiries for insert with check (
  from_organization_id is null or from_organization_id = public.my_org()
);
create policy "listing org reads inquiries" on public.inquiries for select using (
  exists (select 1 from public.properties p where p.id = property_id and p.organization_id = public.my_org())
  or from_organization_id = public.my_org()
);
create policy "listing org updates inquiries" on public.inquiries for update using (
  exists (select 1 from public.properties p where p.id = property_id and p.organization_id = public.my_org())
);

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;
create policy "photos public read" on storage.objects for select using (bucket_id = 'property-photos');
create policy "photos upload by members" on storage.objects for insert to authenticated with check (bucket_id = 'property-photos');
create policy "photos delete own" on storage.objects for delete to authenticated using (bucket_id = 'property-photos' and owner = auth.uid());
