// Supabase Edge Function: connect PMS / MLS accounts and import listings.
//
// Actions (POST JSON body, user JWT in Authorization header):
//   { action: "connect",    provider, credentials }  → validates and stores credentials (server side only)
//   { action: "disconnect", provider }
//   { action: "list",       provider }               → RemoteListing[] (normalised, with imported_property_id)
//   { action: "import",     provider, external_ids } → { created, updated }
//   { action: "refresh_all" }  (service role only; nightly cron) → re-imports every connected org
//
// Providers: guesty (PMS, Open API), resales (Resales Online Web API V6), inmobalia (Kyero XML feed).
// Deploy: supabase functions deploy pms-import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Provider = "guesty" | "resales" | "inmobalia";
type PropertyType = "apartment" | "studio" | "house" | "villa" | "chalet";
interface RemoteListing {
  external_id: string; title: string; description: string; photos: string[]; city: string; area?: string;
  lat?: number | null; lng?: number | null; type: PropertyType; bedrooms: number; bathrooms: number; max_guests: number;
  size_m2?: number | null; amenities: string[]; nightly_rate?: number | null; monthly_rate?: number | null; imported_property_id?: string | null;
}
type Integration = { organization_id: string; provider: Provider; credentials: Record<string, string>; access_token?: string; token_expires_at?: string };

const num = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
const toType = (s = ""): PropertyType => {
  const t = s.toLowerCase();
  if (/villa|detached/.test(t)) return "villa";
  if (/studio/.test(t)) return "studio";
  if (/chalet|cabin/.test(t)) return "chalet";
  if (/house|town|semi|finca|cortijo|bungalow/.test(t)) return "house";
  return "apartment";
};

// ------------------------------------------------------------------ Guesty
async function guestyToken(it: Integration) {
  if (it.access_token && it.token_expires_at && new Date(it.token_expires_at) > new Date(Date.now() + 60_000)) return it.access_token;
  const res = await fetch("https://open-api.guesty.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "open-api", client_id: it.credentials.client_id, client_secret: it.credentials.client_secret }),
  });
  if (!res.ok) throw new Error(`Guesty login failed (${res.status}). Check client ID and secret.`);
  const j = await res.json();
  it.access_token = j.access_token;
  it.token_expires_at = new Date(Date.now() + j.expires_in * 1000).toISOString();
  // Guesty limits token requests: always cache it.
  await sb.from("integrations").update({ access_token: it.access_token, token_expires_at: it.token_expires_at }).eq("organization_id", it.organization_id).eq("provider", "guesty");
  return it.access_token!;
}

async function guestyList(it: Integration): Promise<RemoteListing[]> {
  const token = await guestyToken(it);
  const fields = "_id title nickname publicDescription pictures address bedrooms bathrooms accommodates prices amenities areaSquareFeet propertyType active";
  const out: RemoteListing[] = [];
  for (let skip = 0; skip < 2000; skip += 100) {
    const res = await fetch(`https://open-api.guesty.com/v1/listings?limit=100&skip=${skip}&fields=${encodeURIComponent(fields)}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Guesty listings returned ${res.status}`);
    const j = await res.json();
    for (const l of j.results ?? []) {
      if (l.active === false) continue;
      const d = l.publicDescription ?? {};
      const base = num(l.prices?.basePrice);
      const factor = num(l.prices?.monthlyPriceFactor);
      out.push({
        external_id: l._id,
        title: l.title || l.nickname || "Untitled",
        description: [d.summary, d.space, d.neighborhood].filter(Boolean).join("\n\n"),
        photos: (l.pictures ?? []).map((p: any) => p.original || p.large || p.thumbnail).filter(Boolean),
        city: l.address?.city ?? "",
        area: l.address?.neighborhood ?? undefined,
        lat: num(l.address?.lat), lng: num(l.address?.lng),
        type: toType(l.propertyType),
        bedrooms: num(l.bedrooms) ?? 1, bathrooms: num(l.bathrooms) ?? 1, max_guests: num(l.accommodates) ?? 2,
        size_m2: l.areaSquareFeet ? Math.round(l.areaSquareFeet * 0.0929) : null,
        amenities: l.amenities ?? [],
        nightly_rate: base,
        monthly_rate: base && factor && factor !== 1 ? Math.round(base * 30 * factor) : null,
      });
    }
    if ((j.results ?? []).length < 100) break;
  }
  return out;
}

// ------------------------------------------------------------------ Resales Online (Web API V6)
// Field names follow the V6 docs; verify against your account (some agencies get slightly different payloads).
const RESALES = "https://webapi.resales-online.com/V6";
async function resalesList(it: Integration): Promise<RemoteListing[]> {
  const c = it.credentials;
  const q = (extra: Record<string, string>) => new URLSearchParams({ p1: c.agency_id, p2: c.api_key, P_ApiId: c.filter_id, P_Lang: "1", ...extra });
  const out: RemoteListing[] = [];
  for (let page = 1; page <= 25; page++) {
    const res = await fetch(`${RESALES}/SearchProperties?${q({ P_PageSize: "40", P_PageNo: String(page) })}`);
    if (!res.ok) throw new Error(`Resales Online returned ${res.status}`);
    const j = await res.json();
    if (j.transaction?.status && j.transaction.status !== "success") throw new Error(`Resales Online: ${JSON.stringify(j.transaction.errordescription ?? j.transaction)}`);
    const props = j.Property ?? [];
    for (const p of props) {
      // Details call gives the full photo list and GPS.
      let det: any = p;
      try {
        const r = await fetch(`${RESALES}/PropertyDetails?${q({ P_RefId: p.Reference })}`);
        if (r.ok) det = (await r.json()).Property ?? p;
      } catch { /* keep summary */ }
      const pics = det.Pictures?.Picture ?? [];
      out.push({
        external_id: String(p.Reference),
        title: `${p.PropertyType?.NameType ?? "Property"} in ${p.Location ?? ""}`.trim(),
        description: det.Description ?? p.Description ?? "",
        photos: pics.length ? pics.map((x: any) => x.PictureURL) : [p.MainImage].filter(Boolean),
        city: p.Location ?? "", area: p.Area ?? undefined,
        lat: num(det.GpsY ?? det.Latitude), lng: num(det.GpsX ?? det.Longitude),
        type: toType(p.PropertyType?.NameType),
        bedrooms: num(p.Bedrooms) ?? 1, bathrooms: num(p.Bathrooms) ?? 1, max_guests: (num(p.Bedrooms) ?? 1) * 2,
        size_m2: num(p.Built),
        amenities: (det.PropertyFeatures?.Category ?? []).flatMap((c: any) => c.Value ?? []).slice(0, 30),
        monthly_rate: num(p.Price ?? p.RentalPrice1),
      });
    }
    if (props.length < 40) break;
  }
  return out;
}

// ------------------------------------------------------------------ Inmobalia / any Kyero v3 XML feed
function xmlTag(block: string, tag: string) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
}
async function kyeroList(it: Integration): Promise<RemoteListing[]> {
  const res = await fetch(it.credentials.feed_url);
  if (!res.ok) throw new Error(`Feed returned ${res.status}`);
  const xml = await res.text();
  if (!xml.includes("<property")) throw new Error("No <property> entries in the feed. Is this a Kyero XML feed?");
  const out: RemoteListing[] = [];
  for (const block of xml.split(/<property>/).slice(1)) {
    const freq = xmlTag(block, "price_freq").toLowerCase();
    if (freq === "sale") continue; // rentals only
    const imgs = [...block.matchAll(/<image[^>]*>[\s\S]*?<url>([\s\S]*?)<\/url>/g)].map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim());
    const desc = xmlTag(xmlTag(block, "desc"), "en") || xmlTag(xmlTag(block, "desc"), "es");
    const town = xmlTag(block, "town");
    const price = num(xmlTag(block, "price"));
    out.push({
      external_id: xmlTag(block, "ref") || xmlTag(block, "id"),
      title: `${xmlTag(block, "type") || "Property"} in ${town}`,
      description: desc,
      photos: imgs,
      city: town, area: xmlTag(block, "location_detail") || undefined,
      lat: num(xmlTag(xmlTag(block, "location"), "latitude")), lng: num(xmlTag(xmlTag(block, "location"), "longitude")),
      type: toType(xmlTag(block, "type")),
      bedrooms: num(xmlTag(block, "beds")) ?? 1, bathrooms: num(xmlTag(block, "baths")) ?? 1, max_guests: (num(xmlTag(block, "beds")) ?? 1) * 2,
      size_m2: num(xmlTag(xmlTag(block, "surface_area"), "built")),
      amenities: [...block.matchAll(/<feature>([\s\S]*?)<\/feature>/g)].map((m) => m[1].trim()).slice(0, 30),
      // Kyero price_freq: "month" for long-term, "week" for holiday lets.
      monthly_rate: price ? (freq === "week" ? Math.round(price * 4.3) : price) : null,
    });
  }
  return out;
}

const ADAPTERS: Record<Provider, (it: Integration) => Promise<RemoteListing[]>> = { guesty: guestyList, resales: resalesList, inmobalia: kyeroList };
const REQUIRED: Record<Provider, string[]> = { guesty: ["client_id", "client_secret"], resales: ["agency_id", "api_key", "filter_id"], inmobalia: ["feed_url"] };

// ------------------------------------------------------------------ Import (same rules as src/lib/importMapping.ts)
const TOWN_TO_AREA: Record<string, string> = {
  malaga: "malaga", "rincon de la victoria": "malaga", torremolinos: "torremolinos-benalmadena", benalmadena: "torremolinos-benalmadena",
  "arroyo de la miel": "torremolinos-benalmadena", fuengirola: "fuengirola-mijas", mijas: "fuengirola-mijas", "mijas costa": "fuengirola-mijas",
  "la cala de mijas": "fuengirola-mijas", marbella: "marbella", "puerto banus": "marbella", "nueva andalucia": "marbella",
  "san pedro de alcantara": "marbella", elviria: "marbella", benahavis: "benahavis", estepona: "estepona", casares: "estepona",
  manilva: "manilva-sotogrande", sotogrande: "manilva-sotogrande", "san roque": "manilva-sotogrande", "la duquesa": "manilva-sotogrande",
  nerja: "nerja-axarquia", frigiliana: "nerja-axarquia", torrox: "nerja-axarquia", "velez-malaga": "nerja-axarquia",
};
const norm = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const slugify = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function importListings(it: Integration, list: RemoteListing[]) {
  const { data: regions } = await sb.from("regions").select("id, slug");
  const regionFor = (r: RemoteListing) => {
    const slug = TOWN_TO_AREA[norm(r.area)] ?? TOWN_TO_AREA[norm(r.city)] ?? "malaga";
    return regions?.find((x) => x.slug === slug)?.id ?? regions?.[0]?.id;
  };
  const { data: existing } = await sb.from("properties").select("id, external_id, mirror_content")
    .eq("organization_id", it.organization_id).eq("listing_source", it.provider);
  const byExt = new Map((existing ?? []).map((p) => [p.external_id, p]));
  const isPms = it.provider === "guesty";
  let created = 0, updated = 0;

  for (const r of list) {
    const content = {
      title: r.title, description: r.description, photos: r.photos, city: r.city, area: r.area ?? null, lat: r.lat ?? null, lng: r.lng ?? null,
      type: r.type, bedrooms: r.bedrooms, bathrooms: r.bathrooms, max_guests: r.max_guests, size_m2: r.size_m2 ?? null, amenities: r.amenities,
      region_id: regionFor(r),
    };
    const rates = { source_nightly_rate: r.nightly_rate ?? null, source_monthly_rate: r.monthly_rate ?? null };
    const ex = byExt.get(r.external_id);
    if (ex) {
      await sb.from("properties").update({ ...(ex.mirror_content ? content : {}), ...rates }).eq("id", ex.id);
      updated++;
    } else {
      const { error } = await sb.from("properties").insert({
        ...content, ...rates,
        slug: `${slugify(r.title)}-${crypto.randomUUID().slice(0, 6)}`,
        organization_id: it.organization_id, listing_source: it.provider, external_id: r.external_id, mirror_content: true,
        status: "draft", visibility: "public", min_months: 1, max_months: 12, agent_commission_pct: 10,
        price_mode: isPms && (r.nightly_rate || r.monthly_rate) ? "pms" : "own",
        monthly_price: isPms ? null : r.monthly_rate ?? null,
        calendar_type: isPms ? "pms" : "manual", pms_provider: isPms ? "guesty" : null, pms_listing_id: isPms ? r.external_id : null,
        sync_status: isPms ? "pending" : "never",
      });
      if (error) throw new Error(error.message);
      created++;
    }
  }
  await sb.from("integrations").update({ last_import_at: new Date().toISOString(), status: "ok", error: null })
    .eq("organization_id", it.organization_id).eq("provider", it.provider);
  return { created, updated };
}

// ------------------------------------------------------------------ HTTP
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

    if (body.action === "refresh_all") {
      if (bearer !== SERVICE_KEY) return json({ error: "Forbidden" }, 403);
      const { data: all } = await sb.from("integrations").select("*");
      const results = [];
      for (const it of (all ?? []) as Integration[]) {
        try {
          // Only refresh listings that were imported before; new remote listings wait for the owner to import them.
          const { data: known } = await sb.from("properties").select("external_id").eq("organization_id", it.organization_id).eq("listing_source", it.provider);
          const ids = new Set((known ?? []).map((k) => k.external_id));
          const list = (await ADAPTERS[it.provider](it)).filter((r) => ids.has(r.external_id));
          results.push({ org: it.organization_id, provider: it.provider, ...(await importListings(it, list)) });
        } catch (e) {
          const msg = (e as Error).message;
          await sb.from("integrations").update({ status: "error", error: msg }).eq("organization_id", it.organization_id).eq("provider", it.provider);
          results.push({ org: it.organization_id, provider: it.provider, error: msg });
        }
      }
      return json({ results });
    }

    // User actions: resolve the caller's organization from their JWT.
    const { data: { user } } = await sb.auth.getUser(bearer);
    if (!user) return json({ error: "Please sign in" }, 401);
    const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile) return json({ error: "Profile not found" }, 403);
    const orgId = profile.organization_id as string;
    const provider = body.provider as Provider;
    if (!ADAPTERS[provider]) return json({ error: "Unknown provider" }, 400);

    if (body.action === "connect") {
      const creds = body.credentials ?? {};
      const missing = REQUIRED[provider].filter((k) => !String(creds[k] ?? "").trim());
      if (missing.length) return json({ error: `Please fill in: ${missing.join(", ")}` }, 400);
      const it: Integration = { organization_id: orgId, provider, credentials: creds };
      await sb.from("integrations").upsert({ organization_id: orgId, provider, credentials: creds, access_token: null, token_expires_at: null });
      const test = await ADAPTERS[provider](it).catch(async (e) => {
        await sb.from("integrations").delete().eq("organization_id", orgId).eq("provider", provider);
        throw e;
      });
      const label = provider === "inmobalia" ? new URL(creds.feed_url).host : provider === "resales" ? `Agency ${creds.agency_id}` : `${test.length} listings found`;
      await sb.from("integrations").update({ label, status: "ok", error: null }).eq("organization_id", orgId).eq("provider", provider);
      return json({ provider, label, status: "ok", connected_at: new Date().toISOString() });
    }

    if (body.action === "disconnect") {
      await sb.from("integrations").delete().eq("organization_id", orgId).eq("provider", provider);
      return json({ ok: true });
    }

    const { data: it } = await sb.from("integrations").select("*").eq("organization_id", orgId).eq("provider", provider).maybeSingle();
    if (!it) return json({ error: `${provider} is not connected` }, 400);
    const list = await ADAPTERS[provider](it as Integration);

    if (body.action === "list") {
      const { data: known } = await sb.from("properties").select("id, external_id").eq("organization_id", orgId).eq("listing_source", provider);
      const m = new Map((known ?? []).map((k) => [k.external_id, k.id]));
      return json(list.map((r) => ({ ...r, imported_property_id: m.get(r.external_id) ?? null })));
    }
    if (body.action === "import") {
      const ids = new Set<string>(body.external_ids ?? []);
      return json(await importListings(it as Integration, list.filter((r) => ids.has(r.external_id))));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
