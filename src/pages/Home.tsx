import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarClock, Handshake, Percent, RefreshCw, Search, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/Photo";
import { PropertyCard } from "@/components/PropertyCard";
import { SearchBar } from "@/components/SearchBar";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const HERO = "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2000&q=70";

export default function Home() {
  const { profile } = useAuth();
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  const { data: props = [] } = useQuery({ queryKey: ["search", {}, profile?.id], queryFn: () => api.search({}, profile) });
  const { data: orgs = [] } = useQuery({ queryKey: ["orgs"], queryFn: api.listOrganizations });
  const synced = props.filter((p) => p.calendar.type !== "manual").length;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Photo src={HERO} alt="" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/10" />
        <div className="container relative py-20 md:py-32">
          <div className="max-w-2xl space-y-5">
            <span className="inline-block rounded-full bg-gold/25 px-3 py-1 text-xs font-semibold text-gold-foreground">
              For property managers & agents · €0 platform fee
            </span>
            <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Book the homes you see on Airbnb and Booking.com. Direct, with no fee.</h1>
            <p className="text-lg text-foreground/80">
              The B2B exchange for property managers on the Costa del Sol. Members share the homes they advertise on the big platforms, with live calendars. Your client books direct with the manager, pays no platform fee, and you earn the agent commission.
            </p>
          </div>
          <SearchBar className="mt-10 max-w-5xl" />
        </div>
      </section>

      {/* Stats */}
      <section className="container -mt-2 grid gap-4 py-10 sm:grid-cols-3">
        {[
          { icon: CalendarClock, t: `${props.length} homes with live calendar`, s: `${synced} synced from PMS, Airbnb or Booking.com` },
          { icon: Building2, t: `${orgs.length} property managers & owners`, s: "sharing their stock with agents" },
          { icon: Percent, t: "€0 platform fee", s: "agents earn commission from the manager instead" },
        ].map(({ icon: I, t, s }) => (
          <div key={t} className="flex items-center gap-4 rounded-lg border bg-card p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary"><I className="h-5 w-5" /></span>
            <div><div className="font-semibold">{t}</div><div className="text-sm text-muted-foreground">{s}</div></div>
          </div>
        ))}
      </section>

      {/* Regions */}
      <section className="container py-10">
        <div className="mb-6 flex items-end justify-between">
          <div><h2 className="text-2xl font-bold md:text-3xl">Areas</h2><p className="text-muted-foreground">From Málaga to Sotogrande. More regions later.</p></div>
          <Link to="/areas" className="hidden text-sm text-primary sm:block">All areas →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {regions.slice(0, 8).map((r) => (
            <Link key={r.id} to={`/area/${r.slug}`} className="group relative aspect-[4/5] overflow-hidden rounded-lg">
              <Photo src={r.image} alt={r.name} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 p-5">
                <div className="text-xl font-bold text-white">{r.name}</div>
                <div className="text-sm font-medium text-white/90">{props.filter((p) => p.region_id === r.id).length} homes</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Available now */}
      <section className="container py-10">
        <div className="mb-6 flex items-end justify-between">
          <div><h2 className="text-2xl font-bold md:text-3xl">Available soon</h2><p className="text-muted-foreground">Live availability from members' calendars.</p></div>
          <Link to="/search"><Button variant="outline" size="sm">View all <ArrowRight /></Button></Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{props.slice(0, 6).map((p) => <PropertyCard key={p.id} p={p} />)}</div>
      </section>

      {/* How it works */}
      <section className="border-y bg-secondary/50 py-16">
        <div className="container">
          <h2 className="mb-2 text-center text-2xl font-bold md:text-3xl">How it works for agents and managers</h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">Guests pay 10 to 20% in fees on the big platforms. Here the booking goes direct, and that margin stays between the manager and the agent who brought the client.</p>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { i: Upload, t: "1. Managers share stock", s: "Import the homes you already run on Airbnb and Booking.com from Guesty, Resales Online or Inmobalia, or add them by hand." },
              { i: RefreshCw, t: "2. Calendars stay live", s: "Calendars sync from your PMS, or from the Airbnb / Booking.com iCal link if you have no PMS. Every 15 minutes." },
              { i: Search, t: "3. Agents search the map", s: "Filter by area, dates, bedrooms and price. Only homes that are really free show up, with the commission you earn." },
              { i: Handshake, t: "4. Book direct", s: "Send a booking request for your client. The manager confirms and contracts direct. No platform fee, commission paid to you." },
            ].map(({ i: I, t, s }) => (
              <div key={t} className="rounded-lg border bg-card p-6">
                <I className="mb-4 h-6 w-6 text-primary" />
                <div className="mb-1 font-semibold">{t}</div>
                <p className="text-sm text-muted-foreground">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16">
        <div className="grid gap-6 rounded-2xl bg-primary p-8 text-primary-foreground md:grid-cols-2 md:p-12 [&_p]:text-primary-foreground/75">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Managing homes on Airbnb or Booking.com?</h2>
            <p className="mt-2 text-muted-foreground">Share them here too. Keep your channels, set the commission you pay, and let other agents fill your calendar with direct bookings.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <Link to="/auth?mode=signup"><Button size="lg" variant="gold">Join as property manager</Button></Link>
            <Link to="/list-your-property"><Button size="lg" variant="outline" className="border-white/40 hover:bg-white/10">How it works</Button></Link>
          </div>
        </div>
      </section>
    </>
  );
}
