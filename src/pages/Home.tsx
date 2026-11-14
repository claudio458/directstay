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
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
        <div className="container relative py-20 md:py-32">
          <div className="max-w-2xl space-y-5">
            <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Free in phase 1 · 0% commission · Live calendars
            </span>
            <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Mid-term & winter rentals on the Costa del Sol, shared directly between agents.</h1>
            <p className="text-lg text-muted-foreground">
              Agencies and owners import their listings from Guesty, Resales Online or Inmobalia, or link Airbnb and Booking.com calendars. Every member sees what is really free. No platform fees.
            </p>
          </div>
          <SearchBar className="mt-10 max-w-5xl" />
        </div>
      </section>

      {/* Stats */}
      <section className="container -mt-2 grid gap-4 py-10 sm:grid-cols-3">
        {[
          { icon: CalendarClock, t: `${synced} of ${props.length} listings`, s: "synced from iCal or PMS" },
          { icon: Building2, t: `${orgs.length} agencies & owners`, s: "in the exchange network" },
          { icon: Percent, t: "Free in phase 1", s: "no fees, no booking commission" },
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
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
              <div className="absolute bottom-0 p-5">
                <div className="text-xs text-muted-foreground">{r.country}</div>
                <div className="text-xl font-bold">{r.name}</div>
                <div className="text-sm text-primary">{props.filter((p) => p.region_id === r.id).length} properties</div>
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
      <section className="border-y bg-card/40 py-16">
        <div className="container">
          <h2 className="mb-2 text-center text-2xl font-bold md:text-3xl">How the exchange works</h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">Built for agents who source furnished stays for their clients, and for owners who want qualified tenants without platform fees.</p>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { i: Upload, t: "1. Import or upload", s: "Pull photos, description, location and prices from Guesty, Resales Online or Inmobalia, or add a property by hand." },
              { i: RefreshCw, t: "2. Sync calendar", s: "Calendars sync from your PMS, or from the Airbnb / Booking.com iCal link if you have no PMS. Every 15 minutes." },
              { i: Search, t: "3. Search", s: "Members filter by region, move-in month, length of stay and guests. Only truly free properties show up." },
              { i: Handshake, t: "4. Connect", s: "Send an inquiry for your client. Agencies agree the commission split directly. The platform takes 0%." },
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
        <div className="grid gap-6 rounded-xl border bg-gradient-to-br from-primary/15 to-transparent p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Have properties that sit empty between seasons?</h2>
            <p className="mt-2 text-muted-foreground">List them once, keep your own booking channels, and let partner agencies fill the gaps with mid-term tenants.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <Link to="/auth?mode=signup"><Button size="lg">Join as agency</Button></Link>
            <Link to="/list-your-property"><Button size="lg" variant="outline">I'm a private owner</Button></Link>
          </div>
        </div>
      </section>
    </>
  );
}
