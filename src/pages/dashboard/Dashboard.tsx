import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, CalendarClock, Download, CheckCircle2, Eye, Inbox, Pencil, Plus, Send } from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Photo } from "@/components/Photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api, resetDemo } from "@/lib/api";
import { describeWindow, nextAvailable } from "@/lib/availability";
import { isDemo } from "@/lib/supabase";
import type { InquiryStatus, PropertyWithMeta } from "@/lib/types";
import { cn, effectivePrice, formatPrice } from "@/lib/utils";

export const SOURCE_LABEL = { manual: "Manual", guesty: "Guesty", resales: "Resales Online", inmobalia: "Inmobalia" } as const;

const TABS = [
  { id: "listings", label: "My listings" },
  { id: "inbox", label: "Booking requests received" },
  { id: "sent", label: "Booking requests sent" },
] as const;

function SyncBadge({ p }: { p: PropertyWithMeta }) {
  const c = p.calendar;
  if (c.type === "manual") return <Badge variant="muted">Manual calendar</Badge>;
  if (c.sync_status === "error") return <Badge variant="destructive"><AlertTriangle className="h-3 w-3" />Sync error</Badge>;
  if (c.sync_status === "ok") return <Badge variant="success"><CheckCircle2 className="h-3 w-3" />{c.type === "pms" ? c.pms_provider : "iCal"} · {c.last_synced_at ? formatDistanceToNow(new Date(c.last_synced_at)) + " ago" : ""}</Badge>;
  return <Badge>Sync pending</Badge>;
}

export default function Dashboard() {
  const { profile, organization, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "listings";
  const qc = useQueryClient();
  const orgId = profile?.organization_id ?? "";
  const { data: listings = [] } = useQuery({ queryKey: ["mine", orgId], queryFn: () => api.myProperties(orgId), enabled: !!orgId });
  const { data: inbox = [] } = useQuery({ queryKey: ["inbox", orgId], queryFn: () => api.inboxFor(orgId), enabled: !!orgId });
  const { data: sent = [] } = useQuery({ queryKey: ["sent", orgId], queryFn: () => api.sentBy(orgId), enabled: !!orgId });
  const syncAll = useMutation({
    mutationFn: async () => { for (const p of listings.filter((l) => l.calendar.type !== "manual")) await api.syncCalendar(p.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mine"] }),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, s }: { id: string; s: InquiryStatus }) => api.setInquiryStatus(id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });

  if (loading) return null;
  if (!profile) return <Navigate to="/auth" replace />;

  const newCount = inbox.filter((i) => i.status === "new").length;
  const errors = listings.filter((l) => l.calendar.sync_status === "error").length;

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">{organization?.name}</div>
          <h1 className="text-3xl font-bold">Hello, {profile.full_name.split(" ")[0]}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncAll.mutate()} disabled={syncAll.isPending}><CalendarClock />{syncAll.isPending ? "Syncing…" : "Sync calendars"}</Button>
          <Link to="/dashboard/import"><Button variant="outline"><Download />Import from PMS / MLS</Button></Link>
          <Link to="/dashboard/listings/new"><Button><Plus />Add property</Button></Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          { t: "Listings", v: listings.length },
          { t: "Published", v: listings.filter((l) => l.status === "published").length },
          { t: "New booking requests", v: newCount },
          { t: "Calendar errors", v: errors },
        ].map((s) => <Card key={s.t} className="p-5"><div className="text-sm text-muted-foreground">{s.t}</div><div className="text-2xl font-bold">{s.v}</div></Card>)}
      </div>

      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setParams({ tab: t.id })}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm", tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}{t.id === "inbox" && newCount > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{newCount}</span>}
          </button>
        ))}
      </div>

      {tab === "listings" && (
        listings.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="mb-4 text-muted-foreground">You haven't listed any property yet. Import them from Guesty, Resales Online or Inmobalia, or add one by hand.</p>
            <div className="flex justify-center gap-2"><Link to="/dashboard/import"><Button variant="outline"><Download />Import listings</Button></Link><Link to="/dashboard/listings/new"><Button><Plus />Add manually</Button></Link></div>
          </Card>
        ) : (
          <div className="space-y-3">
            {listings.map((p) => (
              <Card key={p.id} className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
                <Photo src={p.photos[0]} alt={p.title} className="h-24 w-full rounded-md sm:w-36" />
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.title}</span>
                    <Badge variant={p.status === "published" ? "success" : "muted"}>{p.status}</Badge>
                    {p.visibility === "network" && <Badge variant="outline">Network only</Badge>}
                    {p.listing_source !== "manual" && <Badge variant="outline">from {SOURCE_LABEL[p.listing_source]}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">{p.city} · {formatPrice(effectivePrice(p))}{p.price_mode === "pms" ? " (PMS rate)" : ""} · {describeWindow(nextAvailable(p.blocks, p.min_months))}</div>
                  <SyncBadge p={p} />
                </div>
                <div className="flex gap-2">
                  <Link to={`/property/${p.slug}`}><Button variant="ghost" size="sm"><Eye />View</Button></Link>
                  <Link to={`/dashboard/listings/${p.id}`}><Button variant="secondary" size="sm"><Pencil />Edit</Button></Link>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {tab === "inbox" && (
        <div className="space-y-3">
          {inbox.length === 0 && <Card className="p-10 text-center text-muted-foreground"><Inbox className="mx-auto mb-2" />No booking requests yet.</Card>}
          {inbox.map((i) => (
            <Card key={i.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{i.from_name} {i.on_behalf_of_client && <Badge className="ml-1">Agent for client</Badge>}</div>
                  <div className="text-sm text-muted-foreground">{i.property?.title} · move-in {format(new Date(i.move_in), "d MMM yyyy")} · {i.months} mo · {i.guests} guests</div>
                </div>
                <Select className="w-32" value={i.status} onChange={(e) => setStatus.mutate({ id: i.id, s: e.target.value as InquiryStatus })}>
                  <option value="new">New</option><option value="replied">Replied</option><option value="closed">Closed</option>
                </Select>
              </div>
              <p className="mt-3 text-sm">{i.message}</p>
              <div className="mt-3 flex gap-3 text-sm">
                <a className="text-primary" href={`mailto:${i.from_email}?subject=${encodeURIComponent("Re: " + (i.property?.title ?? "your inquiry"))}`}>Reply by email</a>
                {i.from_phone && <a className="text-primary" href={`tel:${i.from_phone}`}>{i.from_phone}</a>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "sent" && (
        <div className="space-y-3">
          {sent.length === 0 && <Card className="p-10 text-center text-muted-foreground"><Send className="mx-auto mb-2" />You haven't sent any booking requests. <Link to="/search" className="text-primary">Find a property</Link></Card>}
          {sent.map((i) => (
            <Card key={i.id} className="flex items-center justify-between p-5">
              <div>
                <Link to={`/property/${i.property?.slug}`} className="font-semibold hover:text-primary">{i.property?.title}</Link>
                <div className="text-sm text-muted-foreground">Move-in {format(new Date(i.move_in), "d MMM yyyy")} · {i.months} mo · sent {formatDistanceToNow(new Date(i.created_at))} ago</div>
              </div>
              <Badge variant={i.status === "new" ? "default" : i.status === "replied" ? "success" : "muted"}>{i.status}</Badge>
            </Card>
          ))}
        </div>
      )}

      {isDemo && (
        <div className="mt-12 text-center">
          <button className="text-xs text-muted-foreground underline" onClick={() => { resetDemo(); location.reload(); }}>Reset demo data</button>
        </div>
      )}
    </div>
  );
}
