import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BadgeCheck, Bath, BedDouble, CalendarClock, Check, Handshake, Lock, Mail, MapPin, Maximize, Phone, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { InquiryForm } from "@/components/InquiryForm";
import { Photo } from "@/components/Photo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { describeWindow, freeWindows } from "@/lib/availability";
import { CHANNEL_LABEL, effectivePrice, formatPrice } from "@/lib/utils";
import { LocationMap } from "@/components/LocationMap";

export default function PropertyPage() {
  const { slug = "" } = useParams();
  const { profile } = useAuth();
  const { data: p, isLoading } = useQuery({ queryKey: ["property", slug], queryFn: () => api.getProperty(slug) });

  if (isLoading) return <div className="container py-20 text-muted-foreground">Loading…</div>;
  if (!p || (p.visibility === "network" && !profile)) {
    return (
      <div className="container py-20 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{p ? "Network members only" : "Property not found"}</h1>
        <p className="mt-2 text-muted-foreground">{p ? "Sign in to see this listing." : "It may have been removed."}</p>
        <Link to={p ? "/auth" : "/search"} className="mt-4 inline-block text-primary">{p ? "Sign in" : "Back to search"} →</Link>
      </div>
    );
  }

  const windows = freeWindows(p.blocks).slice(0, 4);
  const org = p.organization;

  return (
    <div className="container py-8">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/search" className="hover:text-foreground">Search</Link> / <Link to={`/area/${p.region?.slug}`} className="hover:text-foreground">{p.region?.name}</Link>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{p.title}</h1>
          <div className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{[p.area, p.city, p.region?.country].filter(Boolean).join(", ")}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{formatPrice(effectivePrice(p))}</div>
          <div className="text-sm text-muted-foreground">{p.utilities_included ? "Utilities included" : "Utilities extra"} · no platform fee</div>
          {p.listed_on?.length ? <div className="text-xs text-muted-foreground">Also advertised on {p.listed_on.map((c, i) => <span key={c}>{i > 0 && ", "}{p.channel_links?.[c] && profile ? <a className="underline" href={p.channel_links[c]} target="_blank" rel="noreferrer">{CHANNEL_LABEL[c]}</a> : CHANNEL_LABEL[c]}</span>)}</div> : null}
        </div>
      </div>

      {/* Gallery */}
      <div className="mb-8 grid gap-2 overflow-hidden rounded-xl md:h-[440px] md:grid-cols-4 md:grid-rows-2">
        <Photo src={p.photos[0]} alt={p.title} className={`h-64 w-full md:row-span-2 md:h-full ${p.photos.length > 1 ? "md:col-span-2" : "md:col-span-4"}`} />
        {p.photos.slice(1, 5).map((src, i, side) => {
          const span = side.length === 1 ? "md:col-span-2 md:row-span-2" : side.length === 2 || (side.length === 3 && i === 2) ? "md:col-span-2" : "";
          return <Photo key={i} src={src} alt={`${p.title} ${i + 2}`} className={`hidden h-full w-full md:block ${span}`} />;
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="flex flex-wrap gap-3">
            {p.size_m2 && <Badge variant="outline" className="py-1.5"><Maximize className="h-3.5 w-3.5" />{p.size_m2} m²</Badge>}
            <Badge variant="outline" className="py-1.5"><BedDouble className="h-3.5 w-3.5" />{p.bedrooms} bedrooms</Badge>
            <Badge variant="outline" className="py-1.5"><Bath className="h-3.5 w-3.5" />{p.bathrooms} bathrooms</Badge>
            <Badge variant="outline" className="py-1.5"><Users className="h-3.5 w-3.5" />Up to {p.max_guests} guests</Badge>
            <Badge variant="outline" className="py-1.5">{p.min_months}–{p.max_months} months</Badge>
          </div>

          <section>
            <h2 className="mb-2 text-xl font-semibold">About this property</h2>
            <p className="whitespace-pre-line text-muted-foreground">{p.description}</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Amenities</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {p.amenities.map((a) => <div key={a} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />{a}</div>)}
            </div>
          </section>

          {p.lat && p.lng ? (
            <section>
              <h2 className="mb-3 text-xl font-semibold">Location</h2>
              <LocationMap lat={p.lat} lng={p.lng} className="h-72" />
              <p className="mt-2 text-xs text-muted-foreground">Approximate location. Exact address shared by the listing agency.</p>
            </section>
          ) : null}

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Availability</h2>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {p.calendar.type === "manual"
                  ? "Calendar maintained manually"
                  : `Synced via ${p.calendar.type === "pms" ? p.calendar.pms_provider ?? "PMS" : "iCal"}${p.calendar.last_synced_at ? ` ${formatDistanceToNow(new Date(p.calendar.last_synced_at))} ago` : ""}`}
              </span>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {windows.map((w) => <Badge key={w.start} variant="success">{describeWindow(w)}</Badge>)}
            </div>
            <Card><CardContent className="pt-5"><AvailabilityCalendar blocks={p.blocks} /></CardContent></Card>
          </section>
        </div>

        <aside className="space-y-6">
          <Card className="lg:sticky lg:top-24">
            <CardHeader><CardTitle>Request to book</CardTitle></CardHeader>
            <CardContent><InquiryForm p={p} /></CardContent>
          </Card>
          {org && (
            <Card>
              <CardHeader>
                <div className="text-xs uppercase text-muted-foreground">{org.type === "agency" ? "Listed by agency" : "Listed by private owner"}</div>
                <CardTitle className="flex items-center gap-2">{org.name}{org.verified && <BadgeCheck className="h-4 w-4 text-primary" />}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">{org.city}, {org.country}</div>
                {p.agent_commission_pct ? (
                  <div className="flex items-center gap-2 font-medium"><Handshake className="h-4 w-4" />Pays {p.agent_commission_pct}% commission to the booking agent</div>
                ) : null}
                {profile ? (
                  <>
                    <a href={`mailto:${org.email}`} className="flex items-center gap-2 hover:text-primary"><Mail className="h-4 w-4" />{org.email}</a>
                    {org.phone && <a href={`tel:${org.phone}`} className="flex items-center gap-2 hover:text-primary"><Phone className="h-4 w-4" />{org.phone}</a>}
                    <Link to={`/agency/${org.id}`} className="block text-primary">View all listings →</Link>
                  </>
                ) : (
                  <p className="text-muted-foreground"><Link to="/auth" className="text-primary">Sign in</Link> to see direct contact details.</p>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
