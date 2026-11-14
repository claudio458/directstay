-- Owner's own listing pages on other channels, and invite-link referrals.
alter table public.properties add column channel_links jsonb not null default '{}'::jsonb;  -- {"airbnb": "https://…", "booking": "https://…"}
alter table public.organizations add column referred_by text references public.organizations(id) on delete set null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  org_id text;
  ref text := nullif(m->>'referred_by', '');
begin
  if ref is not null and not exists (select 1 from public.organizations where id = ref) then ref := null; end if;
  insert into public.organizations (name, type, city, country, email, phone, referred_by)
  values (
    coalesce(nullif(m->>'org_name', ''), m->>'full_name', new.email),
    coalesce((m->>'org_type')::public.account_type, 'agency'),
    m->>'city', m->>'country', new.email, m->>'phone', ref
  ) returning id into org_id;
  insert into public.profiles (id, email, full_name, role, organization_id)
  values (new.id, new.email, coalesce(m->>'full_name', ''), coalesce((m->>'role')::public.user_role, 'agent'), org_id);
  return new;
end $$;
