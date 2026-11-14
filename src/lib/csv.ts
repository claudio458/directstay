import type { Channel, Property, PropertyType } from "./types";

/** Small RFC 4180 CSV parser (quoted fields, commas/semicolons, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const delim = (t.split("\n")[0].match(/;/g)?.length ?? 0) > (t.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export const CSV_COLUMNS = [
  "title", "city", "area", "type", "bedrooms", "bathrooms", "max_guests", "size_m2", "monthly_price", "min_months", "max_months",
  "commission_pct", "description", "photo_urls", "amenities", "ical_url", "airbnb_url", "booking_url", "lat", "lng",
] as const;

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(",") + "\n" +
  '"Sea-view 2BR in Marbella centre",Marbella,Centro,apartment,2,2,4,90,2400,1,6,10,"Bright apartment 200 m from the beach.","https://example.com/1.jpg | https://example.com/2.jpg","Wi-Fi | Terrace | Parking",https://www.airbnb.com/calendar/ical/123.ics,https://www.airbnb.com/rooms/123,,36.5101,-4.8825\n';

// Header aliases so exports from other tools work without renaming columns.
const ALIAS: Record<string, (typeof CSV_COLUMNS)[number]> = {
  name: "title", titel: "title", titulo: "title", listing: "title", town: "city", location: "city", stadt: "city", ciudad: "city",
  neighbourhood: "area", neighborhood: "area", zona: "area", property_type: "type", tipo: "type", beds: "bedrooms", dormitorios: "bedrooms",
  schlafzimmer: "bedrooms", baths: "bathrooms", banos: "bathrooms", guests: "max_guests", accommodates: "max_guests", sleeps: "max_guests",
  m2: "size_m2", size: "size_m2", built: "size_m2", price: "monthly_price", rent: "monthly_price", monthly_rent: "monthly_price", precio: "monthly_price",
  commission: "commission_pct", agent_commission_pct: "commission_pct", photos: "photo_urls", images: "photo_urls", pictures: "photo_urls",
  features: "amenities", ical: "ical_url", calendar: "ical_url", calendar_url: "ical_url", airbnb: "airbnb_url", booking: "booking_url",
  latitude: "lat", longitude: "lng", lon: "lng",
};
const key = (h: string) => {
  const k = h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  return (CSV_COLUMNS as readonly string[]).includes(k) ? (k as (typeof CSV_COLUMNS)[number]) : ALIAS[k];
};

const TYPES: PropertyType[] = ["apartment", "studio", "house", "villa", "chalet"];
const n = (v?: string) => { const x = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")); return v && !isNaN(x) && String(v).trim() !== "" ? x : undefined; };
/** Prices may use thousands separators: "1.200", "1,200", "€ 2.400,00". */
const money = (v?: string) => {
  let x = String(v ?? "").replace(/[^\d.,]/g, "");
  if (/^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(x)) x = x.replace(/[.,](\d{1,2})$/, "#$1").replace(/[.,]/g, "").replace("#", ".");
  return n(x);
};
const list = (v?: string) => (v ?? "").split(/\s*\|\s*|\s*\n\s*/).map((x) => x.trim()).filter(Boolean);

export function channelOf(url?: string): Channel | undefined {
  if (!url) return;
  if (/airbnb\./i.test(url)) return "airbnb";
  if (/booking\.com/i.test(url)) return "booking";
  if (/vrbo\.|homeaway\./i.test(url)) return "vrbo";
}

export interface CsvRow { line: number; property: Partial<Property>; errors: string[] }

/** Turns CSV text into draft listings. Unknown columns are reported and ignored. */
export function csvToProperties(text: string): { rows: CsvRow[]; unknown: string[] } {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], unknown: [] };
  const cols = header.map(key);
  const unknown = header.filter((_, i) => !cols[i]);
  const rows = body.map((cells, idx) => {
    const r: Record<string, string> = {};
    cols.forEach((c, i) => { if (c) r[c] = (cells[i] ?? "").trim(); });
    const errors: string[] = [];
    if (!r.title) errors.push("title missing");
    if (!r.city) errors.push("city missing");
    const type = (TYPES.find((t) => r.type?.toLowerCase().includes(t)) ?? "apartment") as PropertyType;
    const links: Partial<Record<Channel, string>> = {};
    if (r.airbnb_url) links.airbnb = r.airbnb_url;
    if (r.booking_url) links.booking = r.booking_url;
    const icalCh = channelOf(r.ical_url);
    const listed = [...new Set([...(Object.keys(links) as Channel[]), ...(icalCh ? [icalCh] : [])])];
    const property: Partial<Property> = {
      title: r.title, city: r.city, area: r.area || undefined, type,
      bedrooms: n(r.bedrooms) ?? 1, bathrooms: n(r.bathrooms) ?? 1, max_guests: n(r.max_guests) ?? (n(r.bedrooms) ?? 1) * 2,
      size_m2: n(r.size_m2), monthly_price: money(r.monthly_price) ?? null, min_months: n(r.min_months) ?? 1, max_months: n(r.max_months) ?? 12,
      agent_commission_pct: n(r.commission_pct) ?? 10, description: r.description ?? "", photos: list(r.photo_urls), amenities: list(r.amenities),
      lat: n(r.lat) ?? null, lng: n(r.lng) ?? null, listed_on: listed, channel_links: links, status: "draft",
      calendar: r.ical_url ? { type: "ical", ical_url: r.ical_url, sync_status: "pending" } : { type: "manual", sync_status: "never" },
    };
    return { line: idx + 2, property, errors };
  });
  return { rows, unknown };
}
