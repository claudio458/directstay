-- Channels a home is also advertised on (airbnb, booking, vrbo). Shown to agents as "Also on Airbnb".
alter table public.properties add column listed_on text[] not null default '{}';
