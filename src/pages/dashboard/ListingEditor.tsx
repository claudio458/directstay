import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CalendarClock, Check, ImagePlus, Link2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { Photo } from "@/components/Photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { CalendarSourceType, PmsProvider, Property, PropertyType } from "@/lib/types";
import { CHANNEL_LABEL, cn, formatPrice } from "@/lib/utils";
import { SOURCE_LABEL } from "./Dashboard";
import { LocationMap } from "@/components/LocationMap";

const STEPS = [
  { id: "details", label: "Details" },
  { id: "calendar", label: "Calendar" },
  { id: "photos", label: "Photos" },
  { id: "publish", label: "Publish" },
] as const;
type Step = (typeof STEPS)[number]["id"];

const AMENITIES = ["Wi-Fi", "Workspace", "Air conditioning", "Heating", "Washing machine", "Dishwasher", "Fully equipped kitchen", "Bed linens", "Elevator", "Parking", "Balcony", "Terrace", "Sea view", "Pool", "Garden", "Fireplace", "Sauna", "Ski storage", "Pets allowed", "BBQ grill"];

export default function ListingEditor() {
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const [params, setParams] = useSearchParams();
  const step = (params.get("step") as Step) ?? "details";
  const { profile, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  const { data: existing, refetch } = useQuery({ queryKey: ["edit", id], queryFn: () => api.getPropertyById(id), enabled: !isNew });
  const [p, setP] = useState<Partial<Property>>({});
  // Load the listing once; later refetches (e.g. after adding a block) must not wipe unsaved edits.
  useEffect(() => { if (existing && p.id !== existing.id) setP(existing); }, [existing]);
  useEffect(() => { if (isNew && regions[0] && !p.region_id) setP((x) => ({ ...x, region_id: regions[0].id })); }, [regions, isNew]);

  if (loading) return null;
  if (!profile) return <Navigate to="/auth" replace />;
  if (existing && existing.organization_id !== profile.organization_id) return <Navigate to="/dashboard" replace />;

  const set = <K extends keyof Property>(k: K, v: Property[K]) => setP((x) => ({ ...x, [k]: v }));
  const num = (k: keyof Property) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value === "" ? null : Number(e.target.value)) as never);
  const go = (s: Step) => setParams({ step: s });

  const save = async (next?: Step, extra: Partial<Property> = {}) => {
    try {
      const saved = await api.saveProperty({ ...p, ...extra, organization_id: profile.organization_id });
      qc.invalidateQueries();
      if (isNew) nav(`/dashboard/listings/${saved.id}?step=${next ?? "calendar"}`, { replace: true });
      else { await refetch(); if (next) go(next); }
      toast.success("Saved");
      return saved;
    } catch (e) { toast.error((e as Error).message); }
  };

  const stepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="container max-w-4xl py-8">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
      <h1 className="mb-6 text-3xl font-bold">{isNew ? "Add a property" : p.title}</h1>

      {existing && existing.listing_source !== "manual" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          <div>
            <div className="font-semibold text-primary">Imported from {SOURCE_LABEL[existing.listing_source]} · ref {existing.external_id}</div>
            <div className="text-muted-foreground">{p.mirror_content ? "Title, description, photos and location are kept in sync. Edits here will be overwritten on the next import." : "Content sync is off. Your edits are kept; only rates and calendar still update."}</div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.mirror_content ?? true} onChange={(e) => set("mirror_content", e.target.checked)} />Keep content in sync</label>
        </div>
      )}
      <ol className="mb-8 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button disabled={isNew && i > 0} onClick={() => go(s.id)}
              className={cn("w-full border-t-2 pt-2 text-left text-sm disabled:cursor-not-allowed", i <= stepIdx ? "border-primary text-foreground" : "border-border text-muted-foreground")}>
              <span className="text-xs">Step {i + 1}</span><div className="font-medium">{s.label}</div>
            </button>
          </li>
        ))}
      </ol>

      {step === "details" && (
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save("calendar"); }}>
          <Card>
            <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Title</Label><Input required placeholder="e.g. Sea-view 2BR in Marbella centre" value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="space-y-1"><Label>Region</Label>
                <Select value={p.region_id ?? ""} onChange={(e) => set("region_id", e.target.value)}>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
              </div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={p.type ?? "apartment"} onChange={(e) => set("type", e.target.value as PropertyType)}>{["apartment", "studio", "house", "villa", "chalet"].map((t) => <option key={t} value={t}>{t}</option>)}</Select>
              </div>
              <div className="space-y-1"><Label>City</Label><Input required value={p.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
              <div className="space-y-1"><Label>Area / neighbourhood</Label><Input value={p.area ?? ""} onChange={(e) => set("area", e.target.value)} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={5} value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Location</CardTitle><CardDescription>Approximate is fine. Shown as a map pin; the exact address is shared only after contact.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label>Latitude</Label><Input type="number" step="any" placeholder="36.5101" value={p.lat ?? ""} onChange={num("lat")} /></div>
              <div className="space-y-1"><Label>Longitude</Label><Input type="number" step="any" placeholder="-4.8825" value={p.lng ?? ""} onChange={num("lng")} /></div>
              <p className="text-xs text-muted-foreground sm:col-span-2">Tip: in Google Maps, right-click the building and click the coordinates to copy them.</p>
              {p.lat && p.lng ? <LocationMap lat={p.lat} lng={p.lng} className="h-56 sm:col-span-2" /> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Size & capacity</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1"><Label>m²</Label><Input type="number" min={0} value={p.size_m2 ?? ""} onChange={num("size_m2")} /></div>
              <div className="space-y-1"><Label>Bedrooms</Label><Input type="number" min={0} required value={p.bedrooms ?? 1} onChange={num("bedrooms")} /></div>
              <div className="space-y-1"><Label>Bathrooms</Label><Input type="number" min={0} required value={p.bathrooms ?? 1} onChange={num("bathrooms")} /></div>
              <div className="space-y-1"><Label>Max guests</Label><Input type="number" min={1} required value={p.max_guests ?? 2} onChange={num("max_guests")} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Terms & price</CardTitle><CardDescription>Members see one monthly price. Leave it empty to show "Price on request".</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {(p.source_nightly_rate || p.source_monthly_rate) ? (
                <div className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
                  {([
                    ["own", "Set my own monthly price", "Recommended for mid-term. Ignore the nightly rates from your PMS."],
                    ["pms", "Use the rate from " + (SOURCE_LABEL[p.listing_source ?? "manual"]), p.source_monthly_rate ? `${formatPrice(p.source_monthly_rate)} (monthly rate in your PMS)` : `€${p.source_nightly_rate} / night × 30 ≈ ${formatPrice(Math.round((p.source_nightly_rate ?? 0) * 30))}`],
                  ] as const).map(([v, t, d]) => (
                    <button type="button" key={v} onClick={() => set("price_mode", v)} className={cn("rounded-lg border p-4 text-left", (p.price_mode ?? "own") === v && "border-primary bg-primary/10")}>
                      <div className="font-semibold">{t}</div><div className="text-xs text-muted-foreground">{d}</div>
                    </button>
                  ))}
                </div>
              ) : null}
              {(p.price_mode ?? "own") === "own" && <div className="space-y-1"><Label>Monthly rent (€)</Label><Input type="number" min={0} value={p.monthly_price ?? ""} onChange={num("monthly_price")} /></div>}
              <div className="space-y-1"><Label>Min. months</Label><Input type="number" min={1} max={12} required value={p.min_months ?? 1} onChange={num("min_months")} /></div>
              <div className="space-y-1"><Label>Max. months</Label><Input type="number" min={1} max={24} required value={p.max_months ?? 12} onChange={num("max_months")} /></div>
              <div className="space-y-1"><Label>Agent commission (% of rent)</Label><Input type="number" min={0} max={50} placeholder="e.g. 10" value={p.agent_commission_pct ?? ""} onChange={num("agent_commission_pct")} /></div>
              <label className="flex items-center gap-2 pt-6 text-sm sm:col-span-2">
                <input type="checkbox" checked={p.utilities_included ?? true} onChange={(e) => set("utilities_included", e.target.checked)} /> Utilities included in rent
              </label>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[...new Set([...AMENITIES, ...(p.amenities ?? [])])].map((a) => {
                const on = p.amenities?.includes(a);
                return (
                  <button type="button" key={a} onClick={() => set("amenities", on ? p.amenities!.filter((x) => x !== a) : [...(p.amenities ?? []), a])}
                    className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}>
                    {on && <Check className="mr-1 inline h-3 w-3" />}{a}
                  </button>
                );
              })}
            </CardContent>
          </Card>
          <div className="flex justify-end"><Button type="submit" size="lg">Save & continue</Button></div>
        </form>
      )}

      {step === "calendar" && existing && <CalendarStep p={p} setP={setP} onSave={save} refetch={refetch} blocks={existing.blocks} propertyId={existing.id} />}

      {step === "photos" && existing && (
        <Card>
          <CardHeader><CardTitle>Photos</CardTitle><CardDescription>The first photo is the cover. Add at least 5 good photos.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(p.photos ?? []).map((src, i) => (
                <div key={i} className="group relative">
                  <Photo src={src} alt="" className="aspect-[4/3] w-full rounded-md" />
                  {i === 0 && <Badge className="absolute left-2 top-2 bg-background/85">Cover</Badge>}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    {i > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => set("photos", [src, ...p.photos!.filter((_, j) => j !== i)])}>Cover</Button>}
                    <Button type="button" size="icon" variant="destructive" className="h-9 w-9" onClick={() => set("photos", p.photos!.filter((_, j) => j !== i))}><X /></Button>
                  </div>
                </div>
              ))}
              <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground hover:border-primary">
                <ImagePlus className="h-6 w-6" />Upload
                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  try {
                    const urls = await Promise.all(files.map((f) => api.uploadPhoto(existing.id, f)));
                    set("photos", [...(p.photos ?? []), ...urls]);
                  } catch (err) { toast.error((err as Error).message); }
                }} />
              </label>
            </div>
            <div className="flex gap-2">
              <Input id="photo-url" placeholder="…or paste an image URL" />
              <Button type="button" variant="secondary" onClick={() => {
                const el = document.getElementById("photo-url") as HTMLInputElement;
                if (el.value) { set("photos", [...(p.photos ?? []), el.value]); el.value = ""; }
              }}><Link2 />Add</Button>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => go("calendar")}>Back</Button>
              <Button onClick={() => save("publish")}>Save & continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "publish" && existing && (
        <Card>
          <CardHeader><CardTitle>Visibility & publish</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {([["public", "Public", "Anyone can find it. Contact details only for members."], ["network", "Network only", "Only signed-in agencies and owners can see it."]] as const).map(([v, t, d]) => (
                <button key={v} type="button" onClick={() => set("visibility", v)}
                  className={cn("rounded-lg border p-4 text-left", p.visibility === v && "border-primary bg-primary/10")}>
                  <div className="font-semibold">{t}</div><div className="text-sm text-muted-foreground">{d}</div>
                </button>
              ))}
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Also advertised on</div>
              <div className="flex flex-wrap gap-2">
                {(["airbnb", "booking", "vrbo"] as const).map((c) => {
                  const on = p.listed_on?.includes(c);
                  return (
                    <button type="button" key={c} onClick={() => set("listed_on", on ? p.listed_on!.filter((x) => x !== c) : [...(p.listed_on ?? []), c])}
                      className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground")}>
                      {CHANNEL_LABEL[c]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Agents see that this is the same home their client found on the platform, bookable here without the fee.</p>
            </div>
            <ul className="space-y-1 text-sm">
              {[
                [!!p.title && !!p.city, "Title and city"],
                [(p.photos?.length ?? 0) > 0, "At least one photo"],
                [p.calendar?.type !== "manual" || existing.blocks.length > 0, p.calendar?.type === "manual" ? "Calendar (manual: add blocked dates or connect iCal/PMS)" : "Calendar connected"],
              ].map(([ok, l]) => <li key={l as string} className="flex items-center gap-2">{ok ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}{l}</li>)}
            </ul>
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={async () => { if (confirm("Delete this listing?")) { await api.deleteProperty(existing.id); qc.invalidateQueries(); nav("/dashboard"); } }}><Trash2 />Delete</Button>
              <div className="flex gap-2">
                {p.status === "published"
                  ? <Button variant="outline" onClick={() => save(undefined, { status: "paused" }).then(() => setP((x) => ({ ...x, status: "paused" })))}>Pause listing</Button>
                  : <Button variant="outline" onClick={() => save(undefined, { status: "draft" })}>Save as draft</Button>}
                <Button onClick={async () => { const s = await save(undefined, { status: "published" }); if (s) nav("/dashboard"); }}>Publish</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CalendarStep({ p, setP, onSave, refetch, blocks, propertyId }: {
  p: Partial<Property>; setP: React.Dispatch<React.SetStateAction<Partial<Property>>>;
  onSave: (next?: Step) => Promise<unknown>; refetch: () => Promise<unknown>;
  blocks: { id: string; start_date: string; end_date: string; source: CalendarSourceType; summary?: string }[]; propertyId: string;
}) {
  const cal = p.calendar ?? { type: "manual" as const, sync_status: "never" as const };
  const setCal = (patch: Partial<typeof cal>) => setP((x) => ({ ...x, calendar: { ...cal, ...patch } }));
  const [range, setRange] = useState({ start: "", end: "" });
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    await onSave();
    setSyncing(true);
    const r = await api.syncCalendar(propertyId);
    setSyncing(false);
    await refetch();
    r.error ? toast.warning(r.error) : toast.success(`Calendar synced: ${r.imported} bookings imported`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>How should we get your availability?</CardTitle><CardDescription>Synced calendars refresh automatically every 15 minutes.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {([["ical", "iCal link", "Airbnb, Booking.com, VRBO, Google…"], ["pms", "PMS connection", "Guesty, Hostaway, Smoobu, Lodgify"], ["manual", "Manual", "Block dates yourself"]] as const).map(([v, t, d]) => (
              <button key={v} type="button" onClick={() => setCal({ type: v })} className={cn("rounded-lg border p-4 text-left", cal.type === v && "border-primary bg-primary/10")}>
                <div className="font-semibold">{t}</div><div className="text-xs text-muted-foreground">{d}</div>
              </button>
            ))}
          </div>
          {cal.type === "ical" && (
            <div className="space-y-1">
              <Label>iCal export URL (.ics)</Label>
              <Input placeholder="https://www.airbnb.com/calendar/ical/….ics" value={cal.ical_url ?? ""} onChange={(e) => setCal({ ical_url: e.target.value })} />
              <p className="text-xs text-muted-foreground">Airbnb: Listing → Availability → Sync calendars → Export. Booking.com: Rates & Availability → Sync calendars.</p>
            </div>
          )}
          {cal.type === "pms" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Provider</Label>
                <Select value={cal.pms_provider ?? "guesty"} onChange={(e) => setCal({ pms_provider: e.target.value as PmsProvider })}>
                  {["guesty", "hostaway", "smoobu", "lodgify", "other"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
                </Select>
              </div>
              <div className="space-y-1"><Label>Listing ID in your PMS</Label><Input value={cal.pms_listing_id ?? ""} onChange={(e) => setCal({ pms_listing_id: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground sm:col-span-2">Your agency's PMS API key is stored once under Settings → Integrations (server side), never in the browser.</p>
            </div>
          )}
          {cal.type !== "manual" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={sync} disabled={syncing}>{syncing ? <RefreshCw className="animate-spin" /> : <CalendarClock />}Save & sync now</Button>
              {cal.last_synced_at && <span className="text-xs text-muted-foreground">Last sync {format(new Date(cal.last_synced_at), "d MMM HH:mm")} · {cal.sync_status}</span>}
              {cal.sync_error && <span className="text-xs text-destructive">{cal.sync_error}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Blocked dates</CardTitle><CardDescription>Add manual blocks on top of any synced calendar (e.g. owner use).</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></div>
            <div className="space-y-1"><Label>Until (checkout)</Label><Input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></div>
            <Button type="button" variant="secondary" disabled={!range.start || !range.end || range.end <= range.start} onClick={async () => {
              await api.addBlock({ property_id: propertyId, start_date: range.start, end_date: range.end, source: "manual", summary: "Blocked" });
              setRange({ start: "", end: "" }); refetch();
            }}><Plus />Block</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...blocks].sort((a, b) => a.start_date.localeCompare(b.start_date)).map((b) => (
              <Badge key={b.id} variant={b.source === "manual" ? "default" : "muted"} className="py-1">
                {format(parseISO(b.start_date), "d MMM")} – {format(parseISO(b.end_date), "d MMM yy")} · {b.source}
                {b.source === "manual" && <button onClick={async () => { await api.removeBlock(b.id); refetch(); }}><X className="h-3 w-3" /></button>}
              </Badge>
            ))}
          </div>
          <AvailabilityCalendar blocks={blocks as never} />
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={() => onSave("photos")}>Save & continue</Button></div>
    </div>
  );
}
