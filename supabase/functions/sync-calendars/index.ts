// Supabase Edge Function: pulls availability from iCal feeds and PMS APIs into availability_blocks.
// Invoked (a) by pg_cron every 15 min with no body → syncs every connected listing,
//         (b) from the dashboard with { property_id } → syncs one listing.
// Deploy: supabase functions deploy sync-calendars
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

type Block = { start_date: string; end_date: string; summary?: string; external_uid?: string };

// ---------- iCal ----------
function parseICal(text: string): Block[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const toDate = (v?: string) => v?.match(/(\d{4})(\d{2})(\d{2})/)?.slice(1).join("-") ?? null;
  const out: Block[] = [];
  for (const chunk of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = chunk.split("END:VEVENT")[0];
    const get = (k: string) => body.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "m"))?.[1]?.trim();
    const start = toDate(get("DTSTART"));
    if (!start) continue;
    let end = toDate(get("DTEND"));
    if (!end || end <= start) {
      const d = new Date(start + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); end = d.toISOString().slice(0, 10);
    }
    out.push({ start_date: start, end_date: end, summary: get("SUMMARY"), external_uid: get("UID") });
  }
  return out;
}

async function fromICal(url: string): Promise<Block[]> {
  const res = await fetch(url, { headers: { "User-Agent": "DirectStay-CalendarSync/1.0" } });
  if (!res.ok) throw new Error(`Feed returned ${res.status}`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Not a valid iCal feed");
  return parseICal(text);
}

// ---------- PMS: Guesty (Open API) ----------
async function guestyToken(orgId: string) {
  const { data: row } = await sb.from("integrations").select("*").eq("organization_id", orgId).eq("provider", "guesty").maybeSingle();
  const c = row && { ...row.credentials, access_token: row.access_token, token_expires_at: row.token_expires_at };
  if (!c) throw new Error("No Guesty connection for this organization");
  if (c.access_token && c.token_expires_at && new Date(c.token_expires_at) > new Date(Date.now() + 60_000)) return c.access_token as string;
  const res = await fetch("https://open-api.guesty.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "open-api", client_id: c.client_id, client_secret: c.client_secret }),
  });
  if (!res.ok) throw new Error(`Guesty auth failed (${res.status})`);
  const j = await res.json();
  await sb.from("integrations").update({ access_token: j.access_token, token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() })
    .eq("organization_id", orgId).eq("provider", "guesty");
  return j.access_token as string;
}

/** Turns a per-day calendar into contiguous busy blocks. */
function daysToBlocks(days: { date: string; busy: boolean }[]): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const d of days.sort((a, b) => a.date.localeCompare(b.date))) {
    if (d.busy) {
      const next = new Date(d.date + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
      const nextIso = next.toISOString().slice(0, 10);
      if (cur && cur.end_date === d.date) cur.end_date = nextIso;
      else { cur = { start_date: d.date, end_date: nextIso, summary: "Booked (PMS)" }; out.push(cur); }
    } else cur = null;
  }
  return out;
}

async function fromGuesty(orgId: string, listingId: string): Promise<Block[]> {
  const token = await guestyToken(orgId);
  const start = new Date().toISOString().slice(0, 10);
  const endD = new Date(); endD.setUTCMonth(endD.getUTCMonth() + 12);
  const url = `https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings/${listingId}?startDate=${start}&endDate=${endD.toISOString().slice(0, 10)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Guesty calendar returned ${res.status}`);
  const j = await res.json();
  const days = (j.data?.days ?? j.data ?? []) as { date: string; status: string }[];
  return daysToBlocks(days.map((d) => ({ date: d.date, busy: d.status !== "available" })));
}

// TODO: add Hostaway / Smoobu / Lodgify adapters with the same signature (orgId, listingId) => Block[].
const PMS: Record<string, (orgId: string, listingId: string) => Promise<Block[]>> = { guesty: fromGuesty };

// ---------- Main ----------
async function syncOne(p: Record<string, any>) {
  try {
    let blocks: Block[];
    let source: "ical" | "pms";
    if (p.calendar_type === "ical") {
      if (!p.ical_url) throw new Error("No iCal URL set");
      blocks = await fromICal(p.ical_url); source = "ical";
    } else {
      const adapter = PMS[p.pms_provider];
      if (!adapter) throw new Error(`PMS '${p.pms_provider}' not supported yet`);
      if (!p.pms_listing_id) throw new Error("No PMS listing ID set");
      blocks = await adapter(p.organization_id, p.pms_listing_id); source = "pms";
    }
    // Replace previously imported blocks (manual blocks are kept).
    await sb.from("availability_blocks").delete().eq("property_id", p.id).in("source", ["ical", "pms"]);
    if (blocks.length) {
      const { error } = await sb.from("availability_blocks").insert(blocks.map((b) => ({ ...b, property_id: p.id, source })));
      if (error) throw error;
    }
    await sb.from("properties").update({ sync_status: "ok", sync_error: null, last_synced_at: new Date().toISOString() }).eq("id", p.id);
    return { property_id: p.id, imported: blocks.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("properties").update({ sync_status: "error", sync_error: msg, last_synced_at: new Date().toISOString() }).eq("id", p.id);
    return { property_id: p.id, imported: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
  let q = sb.from("properties").select("id, organization_id, calendar_type, ical_url, pms_provider, pms_listing_id").in("calendar_type", ["ical", "pms"]);
  if (body.property_id) q = q.eq("id", body.property_id);
  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const results = [];
  for (const p of data ?? []) results.push(await syncOne(p)); // sequential: friendly to PMS rate limits
  return new Response(JSON.stringify({ synced: results.length, results }), { headers: { ...cors, "Content-Type": "application/json" } });
});
