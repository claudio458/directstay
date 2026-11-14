import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, CheckCircle2, Download, Plug, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Photo } from "@/components/Photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { isDemo } from "@/lib/supabase";
import { CsvImport, InviteManager, QuickAdd } from "./ImportExtras";
import type { Integration, IntegrationProvider } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

interface ProviderDef {
  id: IntegrationProvider;
  name: string;
  kind: "PMS" | "MLS";
  blurb: string;
  mirrors: string;
  fields: { key: string; label: string; placeholder?: string; secret?: boolean }[];
  help: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "guesty", name: "Guesty", kind: "PMS",
    blurb: "Mirror your Guesty listings: photos, description, location, nightly rates and the live calendar.",
    mirrors: "Photos · description · location · rates · calendar",
    fields: [{ key: "client_id", label: "Client ID" }, { key: "client_secret", label: "Client secret", secret: true }],
    help: "Guesty → Integrations → Marketplace → API → New secret token. Read-only access is enough.",
  },
  {
    id: "resales", name: "Resales Online", kind: "MLS",
    blurb: "Import your rental listings from the Resales Online network (Web API V6).",
    mirrors: "Photos · description · location · monthly price",
    fields: [{ key: "agency_id", label: "Agency ID (p1)" }, { key: "api_key", label: "API key (p2)", secret: true }, { key: "filter_id", label: "Filter ID for rentals (P_ApiId)" }],
    help: "Resales Online → Admin → Web API. Create a filter with only your long-term / short-term rentals and whitelist our server IP.",
  },
  {
    id: "inmobalia", name: "Inmobalia", kind: "MLS",
    blurb: "Import from your Inmobalia CRM using its XML export feed (Kyero format).",
    mirrors: "Photos · description · location · monthly price",
    fields: [{ key: "feed_url", label: "XML feed URL", placeholder: "https://…/kyero.xml" }],
    help: "Inmobalia → Portals / Exports → enable a Kyero XML feed with your rental properties and copy its URL.",
  },
];

function ProviderCard({ def, integration, orgId }: { def: ProviderDef; integration?: Integration; orgId: string }) {
  const qc = useQueryClient();
  const [creds, setCreds] = useState<Record<string, string>>(Object.fromEntries(def.fields.map((f) => [f.key, ""])));
  const [selected, setSelected] = useState<string[]>([]);
  const connected = !!integration;

  const connect = useMutation({
    mutationFn: () => api.connectIntegration(orgId, def.id, creds),
    onSuccess: () => { toast.success(`${def.name} connected`); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const disconnect = useMutation({
    mutationFn: () => api.disconnectIntegration(orgId, def.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
  const remote = useQuery({
    queryKey: ["remote", def.id, orgId],
    queryFn: () => api.fetchRemoteListings(orgId, def.id),
    enabled: connected,
  });
  const doImport = useMutation({
    mutationFn: (ids: string[]) => api.importRemoteListings(orgId, def.id, ids),
    onSuccess: (r) => {
      toast.success(`${r.created} new listing${r.created === 1 ? "" : "s"} imported as draft, ${r.updated} updated`);
      setSelected([]);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const list = remote.data ?? [];
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>{def.name}</CardTitle>
            <Badge variant="muted">{def.kind}</Badge>
            {connected && <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Connected</Badge>}
          </div>
          <CardDescription className="mt-1">{def.blurb}</CardDescription>
          <div className="mt-1 text-xs text-primary">Mirrors: {def.mirrors}</div>
        </div>
        {connected && <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()}><Unplug />Disconnect</Button>}
      </CardHeader>
      <CardContent>
        {!connected ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); connect.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-3">
              {def.fields.map((f) => (
                <div key={f.key} className={cn("space-y-1", def.fields.length === 1 && "sm:col-span-3")}>
                  <Label>{f.label}</Label>
                  <Input type={f.secret ? "password" : "text"} autoComplete="off" placeholder={f.placeholder} value={creds[f.key]} onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{def.help} Credentials are stored on the server and never shown again.</p>
            <Button type="submit" disabled={connect.isPending}><Plug />{connect.isPending ? "Connecting…" : `Connect ${def.name}`}</Button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{integration.label}{integration.last_import_at ? ` · last import ${formatDistanceToNow(new Date(integration.last_import_at))} ago` : ""}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => remote.refetch()}><RefreshCw className={remote.isFetching ? "animate-spin" : ""} />Refresh</Button>
                <Button variant="secondary" size="sm" disabled={!list.length || doImport.isPending} onClick={() => doImport.mutate(list.map((l) => l.external_id))}>Import / update all ({list.length})</Button>
                <Button size="sm" disabled={!selected.length || doImport.isPending} onClick={() => doImport.mutate(selected)}><Download />Import selected ({selected.length})</Button>
              </div>
            </div>
            {remote.isError && <p className="text-sm text-destructive">{(remote.error as Error).message}</p>}
            <div className="divide-y rounded-md border">
              {list.map((l) => (
                <label key={l.external_id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-accent/40">
                  <input type="checkbox" checked={selected.includes(l.external_id)} onChange={() => toggle(l.external_id)} />
                  <Photo src={l.photos[0]} alt={l.title} className="h-12 w-16 shrink-0 rounded" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {[l.area, l.city].filter(Boolean).join(", ")} · {l.bedrooms} bd · {l.photos.length} photos · ref {l.external_id}
                    </div>
                  </div>
                  <div className="hidden text-right text-xs sm:block">
                    {l.monthly_rate ? <div>{formatPrice(l.monthly_rate)}</div> : null}
                    {l.nightly_rate ? <div className="text-muted-foreground">€{l.nightly_rate} / night</div> : null}
                  </div>
                  {l.imported_property_id ? <Badge variant="success">Imported</Badge> : <Badge variant="muted">New</Badge>}
                </label>
              ))}
              {!list.length && !remote.isFetching && <div className="p-6 text-center text-sm text-muted-foreground">No listings found.</div>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ImportListings() {
  const { profile, loading } = useAuth();
  const orgId = profile?.organization_id ?? "";
  const { data: integrations = [] } = useQuery({ queryKey: ["integrations", orgId], queryFn: () => api.listIntegrations(orgId), enabled: !!orgId });
  if (loading) return null;
  if (!profile) return <Navigate to="/auth" replace />;

  return (
    <div className="container max-w-4xl py-8">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
      <h1 className="text-3xl font-bold">Add your listings</h1>
      <p className="mb-6 mt-1 text-muted-foreground">
        Pick whatever matches how you work today. Everything arrives as a draft, so you can check the price before you publish.
      </p>
      {isDemo && <p className="mb-6 rounded-md bg-secondary p-3 text-sm text-muted-foreground">Demo mode: any credentials work and sample listings are returned.</p>}
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {[["#quick", "Airbnb / Booking.com link"], ["#software", "Guesty, Resales Online, Inmobalia"], ["#csv", "Spreadsheet (CSV)"], ["#invite", "Invite a manager"]].map(([h, l]) => (
          <a key={h} href={h} onClick={(e) => { e.preventDefault(); document.querySelector(h)?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-full border px-3 py-1.5 hover:bg-accent">{l}</a>
        ))}
      </nav>
      <div className="space-y-6">
        <div id="quick" className="scroll-mt-24"><QuickAdd orgId={orgId} /></div>
        <h2 id="software" className="scroll-mt-24 pt-2 text-xl font-semibold">Connect your software</h2>
        {PROVIDERS.map((d) => <ProviderCard key={d.id} def={d} orgId={orgId} integration={integrations.find((i) => i.provider === d.id)} />)}
        <div id="csv" className="scroll-mt-24"><CsvImport orgId={orgId} /></div>
        <div id="invite" className="scroll-mt-24"><InviteManager /></div>
        <p className="text-sm text-muted-foreground">Prefer to type it in? <Link to="/dashboard/listings/new" className="font-medium underline">Add a property by hand</Link>.</p>
        <p className="text-xs text-muted-foreground">Using Hostaway, Smoobu, Lodgify or another CRM? Tell us. New connectors use the same import format.</p>
      </div>
    </div>
  );
}
