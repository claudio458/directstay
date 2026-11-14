import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, FileSpreadsheet, Link2, Mail, Upload, UserPlus, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { channelOf, CSV_TEMPLATE, csvToProperties } from "@/lib/csv";
import { matchRegion } from "@/lib/importMapping";
import type { Channel, Property } from "@/lib/types";
import { CHANNEL_LABEL, eur } from "@/lib/utils";

/** Fastest path for owners without a PMS: their own listing link + calendar link + price. */
export function QuickAdd({ orgId }: { orgId: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  const [f, setF] = useState({ listing_url: "", ical_url: "", title: "", city: "", bedrooms: "1", monthly_price: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const channel = channelOf(f.listing_url) ?? channelOf(f.ical_url);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const linkCh = channelOf(f.listing_url);
      const listed = [...new Set([linkCh, channelOf(f.ical_url)].filter(Boolean))] as Channel[];
      const region = matchRegion({ city: f.city }, regions) ?? regions[0];
      const beds = Number(f.bedrooms) || 1;
      const saved = await api.saveProperty({
        organization_id: orgId, title: f.title, city: f.city, region_id: region.id, bedrooms: beds, max_guests: beds * 2,
        monthly_price: f.monthly_price ? Number(f.monthly_price) : null, listed_on: listed,
        channel_links: linkCh ? { [linkCh]: f.listing_url } : {},
        calendar: f.ical_url ? { type: "ical", ical_url: f.ical_url, sync_status: "pending" } : { type: "manual", sync_status: "never" },
        status: "draft",
      });
      if (f.ical_url) await api.syncCalendar(saved.id);
      qc.invalidateQueries();
      toast.success("Draft created. Add photos and publish.");
      nav(`/dashboard/listings/${saved.id}?step=photos`);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-gold" /><CardTitle>Quick add from your Airbnb or Booking.com listing</CardTitle><Badge variant="muted">1 minute</Badge></div>
        <CardDescription>No PMS needed. Paste the link to your own listing and its calendar link. Availability then syncs every 15 minutes, and agents see it is the same home.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-3"><Label>Your listing link</Label><Input placeholder="https://www.airbnb.com/rooms/…" value={f.listing_url} onChange={set("listing_url")} /></div>
          <div className="space-y-1 sm:col-span-3"><Label>Calendar link (iCal export)</Label><Input placeholder="https://www.airbnb.com/calendar/ical/….ics" value={f.ical_url} onChange={set("ical_url")} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Title</Label><Input required placeholder="Sea-view 2BR in Marbella" value={f.title} onChange={set("title")} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Town</Label><Input required placeholder="Marbella" value={f.city} onChange={set("city")} /></div>
          <div className="space-y-1"><Label>Bedrooms</Label><Input type="number" min={0} value={f.bedrooms} onChange={set("bedrooms")} /></div>
          <div className="space-y-1"><Label>€ / month</Label><Input type="number" min={0} placeholder="2400" value={f.monthly_price} onChange={set("monthly_price")} /></div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
            <Button type="submit" disabled={busy}><Link2 />{busy ? "Creating…" : "Create listing"}</Button>
            {channel && <span className="text-sm text-success"><Check className="mr-1 inline h-4 w-4" />{CHANNEL_LABEL[channel]} link recognised</span>}
            <span className="text-xs text-muted-foreground">Airbnb: Calendar → Availability → Connect calendars → Export. Booking.com: Rates & Availability → Sync calendars. Photos and description are added in the next step.</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Bulk upload from any spreadsheet / CRM export. */
export function CsvImport({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? csvToProperties(text) : null), [text]);
  const good = parsed?.rows.filter((r) => !r.errors.length) ?? [];

  const doImport = async () => {
    setBusy(true);
    try {
      for (const r of good) {
        const region = matchRegion({ city: r.property.city ?? "", area: r.property.area }, regions) ?? regions[0];
        await api.saveProperty({ ...(r.property as Partial<Property>), region_id: region.id, organization_id: orgId });
      }
      qc.invalidateQueries();
      toast.success(`${good.length} listing${good.length === 1 ? "" : "s"} imported as drafts`);
      nav("/dashboard");
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-gold" /><CardTitle>Bulk upload from a spreadsheet</CardTitle><Badge variant="muted">CSV</Badge></div>
        <CardDescription>Export your listings from any software (Excel, Google Sheets, your CRM) as CSV and upload the file. Common column names in English, Spanish and German are recognised.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4" />Choose CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setText(await file.text()); e.target.value = ""; }} />
          </label>
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="directstay-listings-template.csv"><Button type="button" variant="outline"><Download />Download template</Button></a>
          <Button type="button" variant="ghost" onClick={() => setText(CSV_TEMPLATE)}>Try with example</Button>
        </div>
        <Textarea rows={3} className="font-mono text-xs" placeholder="…or paste CSV rows here (first row = column names)" value={text} onChange={(e) => setText(e.target.value)} />
        {parsed && (
          <>
            {parsed.unknown.length > 0 && <p className="text-xs text-muted-foreground">Ignored columns: {parsed.unknown.join(", ")}</p>}
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-secondary text-xs"><tr>{["Row", "Title", "Town", "Beds", "Price", "Photos", "Calendar", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {parsed.rows.map((r) => (
                    <tr key={r.line} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{r.line}</td>
                      <td className="px-3 py-2">{r.property.title || "—"}</td>
                      <td className="px-3 py-2">{r.property.city || "—"}</td>
                      <td className="px-3 py-2">{r.property.bedrooms}</td>
                      <td className="px-3 py-2">{r.property.monthly_price ? eur(r.property.monthly_price) : "on request"}</td>
                      <td className="px-3 py-2">{r.property.photos?.length ?? 0}</td>
                      <td className="px-3 py-2">{r.property.calendar?.type === "ical" ? "iCal" : "manual"}</td>
                      <td className="px-3 py-2">{r.errors.length ? <Badge variant="destructive">{r.errors.join(", ")}</Badge> : <Badge variant="success">Ready</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button disabled={!good.length || busy} onClick={doImport}><Upload />{busy ? "Importing…" : `Import ${good.length} listing${good.length === 1 ? "" : "s"} as drafts`}</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Grow the network through people you already work with: a personal invite link. */
export function InviteManager() {
  const { organization } = useAuth();
  const { data: orgs = [] } = useQuery({ queryKey: ["orgs"], queryFn: api.listOrganizations });
  const [copied, setCopied] = useState(false);
  if (!organization) return null;
  const base = `${location.origin}${import.meta.env.VITE_HASH_ROUTER ? location.pathname + "#" : ""}`;
  const link = `${base}/auth?mode=signup&ref=${organization.id}`;
  const joined = orgs.filter((o) => o.referred_by === organization.id);
  const subject = `Join ${organization.name} on DirectStay`;
  const body = `Hi,\n\nwe share our rental homes with partner agents on DirectStay, a free B2B exchange for property managers on the Costa del Sol. Agents book direct for their clients with no platform fee and earn commission.\n\nYou can add your homes in a few minutes (Guesty, Resales Online, Inmobalia, or your Airbnb / Booking.com calendar link):\n${link}\n\nBest regards\n${organization.name}`;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-gold" /><CardTitle>Invite a property manager you know</CardTitle></div>
        <CardDescription>More managers means more homes for your clients. Send your personal link to managers and owners you already work with.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input readOnly value={link} className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.info("Select the link and copy it"); } }}>
            {copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy link"}
          </Button>
          <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}><Button><Mail />Write invite email</Button></a>
        </div>
        <p className="text-sm text-muted-foreground">
          {joined.length ? `${joined.length} manager${joined.length === 1 ? "" : "s"} joined with your link: ${joined.map((o) => o.name).join(", ")}.` : "Nobody has joined with your link yet."}
        </p>
      </CardContent>
    </Card>
  );
}
