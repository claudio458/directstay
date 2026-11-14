import { addDays, format, startOfDay } from "date-fns";
import type { AvailabilityBlock, Inquiry, Organization, Property, Region, RemoteListing } from "@/lib/types";

/**
 * Demo data for phase 1 (Costa del Sol only). Used when no Supabase keys are configured,
 * and exported to supabase/seed.sql by scripts/make-seed-sql.mjs.
 * "regions" are areas/towns; add other countries later without schema changes.
 */
const img = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
const R = (slug: string, name: string, photo: string, blurb: string): Region => ({ id: `r-${slug}`, slug, name, country: "Spain", image: img(photo), blurb });

export const regions: Region[] = [
  R("malaga", "Málaga", "1522708323590-d24dbb6b0267", "City living, universities and the port. Strong demand for 1 to 6 month stays."),
  R("torremolinos-benalmadena", "Torremolinos & Benalmádena", "1560448204-e02f11c3d0e2", "Beachfront apartments close to the airport, popular with winter guests."),
  R("fuengirola-mijas", "Fuengirola & Mijas", "1493809842364-78817add7ffb", "Family-friendly coast with international schools and long promenades."),
  R("marbella", "Marbella", "1613490493576-7fde63acd811", "Golden Mile, Puerto Banús and Nueva Andalucía. Premium long stays."),
  R("benahavis", "Benahavís", "1512917774080-9991f1c4c750", "Villas in the hills, golf and privacy, 10 minutes from the coast."),
  R("estepona", "Estepona", "1600596542815-ffad4c1539a9", "Old town charm and new beachfront developments."),
  R("manilva-sotogrande", "Manilva & Sotogrande", "1600585154340-be6161a56a0c", "Marinas, polo and golf on the western Costa del Sol."),
  R("nerja-axarquia", "Nerja & Axarquía", "1564013799919-ab600027ffc6", "Whitewashed villages and quiet coves east of Málaga."),
];

export const organizations: Organization[] = [
  { id: "o-cqre", name: "Conquer Real Estate", type: "agency", city: "Marbella", country: "Spain", verified: true, email: "rentals@example.com", phone: "+34 600 000 001", website: "https://example.com", bio: "Boutique agency for mid-term and winter rentals on the Costa del Sol. Portfolio managed in Guesty." },
  { id: "o-sol", name: "Sol Rentals Fuengirola", type: "agency", city: "Fuengirola", country: "Spain", verified: true, email: "office@example.com", phone: "+34 600 000 002", bio: "Long-stay apartments between Torremolinos and Mijas. Listings come from Resales Online." },
  { id: "o-est", name: "Estepona Homes", type: "agency", city: "Estepona", country: "Spain", verified: true, email: "hello@example.com", phone: "+34 600 000 003", bio: "Family agency in Estepona and Manilva. Inmobalia CRM." },
  { id: "o-priv1", name: "María S. (private owner)", type: "private", city: "Nerja", country: "Spain", verified: false, email: "maria@example.com", bio: "Two holiday homes, rented on Airbnb in summer and mid-term in winter." },
];

const AMEN = {
  city: ["Wi-Fi", "Workspace", "Washing machine", "Dishwasher", "Air conditioning", "Elevator", "Bed linens", "Fully equipped kitchen"],
  coast: ["Wi-Fi", "Sea view", "Terrace", "Pool", "Air conditioning", "Parking", "Bed linens", "Fully equipped kitchen", "Workspace"],
  villa: ["Wi-Fi", "Private pool", "Garden", "Parking", "Air conditioning", "Heating", "BBQ grill", "Fully equipped kitchen"],
};

const now = new Date().toISOString();
type Seed = Pick<Property, "id" | "organization_id" | "region_id" | "title" | "city" | "type" | "bedrooms" | "bathrooms" | "max_guests" | "min_months" | "max_months" | "description" | "amenities" | "photos"> & Partial<Property>;

const raw: Seed[] = [
  { id: "p1", listed_on: ["airbnb", "booking"], organization_id: "o-cqre", region_id: "r-marbella", title: "Sea-view penthouse, Golden Mile", city: "Marbella", area: "Golden Mile", lat: 36.5068, lng: -4.9156, type: "apartment", size_m2: 140, bedrooms: 3, bathrooms: 2, max_guests: 6, min_months: 1, max_months: 6, monthly_price: 4800, agent_commission_pct: 10, description: "Bright penthouse with wraparound terrace and open sea views, 5 minutes walk to the beach. Ideal for families spending the winter on the coast.", amenities: AMEN.coast, photos: [img("1613490493576-7fde63acd811"), img("1600596542815-ffad4c1539a9"), img("1600585154340-be6161a56a0c")], listing_source: "guesty", external_id: "gst-6512a1", source_nightly_rate: 210, source_monthly_rate: 5400, calendar: { type: "pms", pms_provider: "guesty", pms_listing_id: "gst-6512a1", sync_status: "ok", last_synced_at: now } },
  { id: "p2", listed_on: ["airbnb", "booking"], organization_id: "o-cqre", region_id: "r-malaga", title: "Chic 1BR in Málaga Centro", city: "Málaga", area: "Centro", lat: 36.7213, lng: -4.4214, type: "apartment", size_m2: 30, bedrooms: 1, bathrooms: 1, max_guests: 2, min_months: 1, max_months: 7, price_mode: "pms", agent_commission_pct: 8, description: "Renovated one-bedroom on Calle Gordon, steps from Calle Larios. Fast Wi-Fi and a proper desk for remote work.", amenities: AMEN.city, photos: [img("1522708323590-d24dbb6b0267"), img("1505691938895-1758d7feb511")], listing_source: "guesty", external_id: "gst-77c0f2", source_nightly_rate: 68, source_monthly_rate: 2000, calendar: { type: "pms", pms_provider: "guesty", pms_listing_id: "gst-77c0f2", sync_status: "ok", last_synced_at: now } },
  { id: "p3", listed_on: ["airbnb"], organization_id: "o-cqre", region_id: "r-malaga", title: "Soho family flat near the port", city: "Málaga", area: "Soho", lat: 36.7175, lng: -4.4260, type: "apartment", size_m2: 100, bedrooms: 4, bathrooms: 2, max_guests: 7, min_months: 2, max_months: 6, monthly_price: null, agent_commission_pct: 10, description: "Spacious four-bedroom flat in Soho with balcony, close to the port and museums.", amenities: AMEN.city, photos: [img("1560448204-e02f11c3d0e2"), img("1493809842364-78817add7ffb")], listing_source: "guesty", external_id: "gst-90ab33", source_nightly_rate: 120, calendar: { type: "pms", pms_provider: "guesty", pms_listing_id: "gst-90ab33", sync_status: "ok", last_synced_at: now } },
  { id: "p4", listed_on: ["airbnb", "vrbo"], organization_id: "o-cqre", region_id: "r-benahavis", title: "Villa with heated pool, La Zagaleta views", city: "Benahavís", lat: 36.5236, lng: -5.0461, type: "villa", size_m2: 280, bedrooms: 5, bathrooms: 4, max_guests: 10, min_months: 1, max_months: 12, monthly_price: 9500, agent_commission_pct: 12, description: "Quiet villa with heated pool and mountain-to-sea views. Gardener and pool service included.", amenities: [...AMEN.villa, "Heated pool"], photos: [img("1512917774080-9991f1c4c750"), img("1600607687939-ce8a6c25118c")], listing_source: "manual", calendar: { type: "ical", ical_url: "https://www.airbnb.com/calendar/ical/444.ics", sync_status: "ok", last_synced_at: now } },
  { id: "p5", listed_on: ["booking"], organization_id: "o-sol", region_id: "r-fuengirola-mijas", title: "Frontline 2BR, Los Boliches", city: "Fuengirola", area: "Los Boliches", lat: 36.5867, lng: -4.6176, type: "apartment", size_m2: 85, bedrooms: 2, bathrooms: 2, max_guests: 4, min_months: 1, max_months: 6, monthly_price: 1900, agent_commission_pct: 10, description: "Beachfront apartment with sea-facing terrace on the promenade. Train to Málaga 5 minutes walk.", amenities: AMEN.coast, photos: [img("1586023492125-27b2c045efd7"), img("1484154218962-a197022b5858")], listing_source: "resales", external_id: "R4512233" },
  { id: "p6", organization_id: "o-sol", region_id: "r-fuengirola-mijas", title: "Townhouse with garden, Mijas Golf", city: "Mijas", area: "Mijas Golf", lat: 36.5503, lng: -4.6735, type: "house", size_m2: 160, bedrooms: 3, bathrooms: 3, max_guests: 6, min_months: 2, max_months: 12, monthly_price: 2600, agent_commission_pct: 10, description: "Quiet townhouse on the golf course with communal pool. Close to international schools.", amenities: [...AMEN.villa, "Golf view"], photos: [img("1600585154340-be6161a56a0c"), img("1518780664697-55e3ad937233")], listing_source: "resales", external_id: "R4498120" },
  { id: "p7", listed_on: ["airbnb", "booking"], organization_id: "o-sol", region_id: "r-torremolinos-benalmadena", title: "Studio by the marina, Benalmádena", city: "Benalmádena", area: "Puerto Marina", lat: 36.5966, lng: -4.5132, type: "studio", size_m2: 38, bedrooms: 1, bathrooms: 1, max_guests: 2, min_months: 1, max_months: 12, monthly_price: 1100, agent_commission_pct: 8, description: "Compact studio with balcony over the marina. Perfect for a single winter guest.", amenities: AMEN.city, photos: [img("1505691938895-1758d7feb511"), img("1522708323590-d24dbb6b0267")], listing_source: "resales", external_id: "R4470551" },
  { id: "p8", listed_on: ["airbnb"], organization_id: "o-est", region_id: "r-estepona", title: "Old-town apartment with roof terrace", city: "Estepona", area: "Casco Antiguo", lat: 36.4256, lng: -5.1459, type: "apartment", size_m2: 70, bedrooms: 2, bathrooms: 1, max_guests: 4, min_months: 1, max_months: 6, monthly_price: 1600, agent_commission_pct: 10, description: "Charming flat among the flower-pot streets, 3 minutes to the beach.", amenities: [...AMEN.city, "Roof terrace"], photos: [img("1484154218962-a197022b5858"), img("1586023492125-27b2c045efd7")], listing_source: "inmobalia", external_id: "INM-22841" },
  { id: "p9", organization_id: "o-est", region_id: "r-estepona", title: "New-build 3BR, Estepona beachfront", city: "Estepona", area: "New Golden Mile", lat: 36.4520, lng: -5.0700, type: "apartment", size_m2: 120, bedrooms: 3, bathrooms: 2, max_guests: 6, min_months: 1, max_months: 12, monthly_price: 3200, agent_commission_pct: 10, description: "Contemporary apartment in a gated complex with pools and gym, direct beach access.", amenities: AMEN.coast, photos: [img("1600607687939-ce8a6c25118c"), img("1600596542815-ffad4c1539a9")], listing_source: "inmobalia", external_id: "INM-23017", visibility: "network" },
  { id: "p10", organization_id: "o-est", region_id: "r-manilva-sotogrande", title: "Marina apartment, Sotogrande", city: "Sotogrande", area: "Marina", lat: 36.2884, lng: -5.2699, type: "apartment", size_m2: 110, bedrooms: 2, bathrooms: 2, max_guests: 4, min_months: 2, max_months: 12, monthly_price: 2800, agent_commission_pct: 12, description: "Waterfront apartment overlooking the yachts. Polo and golf a short drive away.", amenities: [...AMEN.coast, "Marina view"], photos: [img("1520250497591-112f2f40a3f4"), img("1493809842364-78817add7ffb")], listing_source: "inmobalia", external_id: "INM-21990" },
  { id: "p11", listed_on: ["airbnb"], organization_id: "o-priv1", region_id: "r-nerja-axarquia", title: "Cliff-top house above Burriana beach", city: "Nerja", lat: 36.7480, lng: -3.8640, type: "house", size_m2: 150, bedrooms: 3, bathrooms: 2, max_guests: 6, min_months: 2, max_months: 6, monthly_price: 2400, agent_commission_pct: null, description: "Andalusian house with sea-view terrace and plunge pool, walking distance to the Balcón de Europa.", amenities: ["Wi-Fi", "Sea view", "Terrace", "Pool", "Parking", "Fully equipped kitchen"], photos: [img("1564013799919-ab600027ffc6"), img("1600596542815-ffad4c1539a9")], calendar: { type: "ical", ical_url: "https://www.airbnb.com/calendar/ical/123.ics", sync_status: "ok", last_synced_at: now } },
  { id: "p12", listed_on: ["booking"], organization_id: "o-priv1", region_id: "r-nerja-axarquia", title: "Village casita in Frigiliana", city: "Frigiliana", lat: 36.7907, lng: -3.8958, type: "house", size_m2: 65, bedrooms: 1, bathrooms: 1, max_guests: 2, min_months: 1, max_months: 6, monthly_price: 1200, agent_commission_pct: null, description: "Whitewashed casita with roof terrace in one of Spain's prettiest villages.", amenities: ["Wi-Fi", "Roof terrace", "Fireplace", "Fully equipped kitchen"], photos: [img("1518780664697-55e3ad937233"), img("1484154218962-a197022b5858")], calendar: { type: "ical", ical_url: "https://admin.booking.com/hotel/ical/abc.ics", sync_status: "error", sync_error: "Feed returned 404", last_synced_at: now } },
];

const slug = (t: string, id: string) => `${t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${id}`;

export const properties: Property[] = raw.map((p) => ({
  slug: slug(p.title, p.id),
  created_at: now,
  visibility: "public",
  status: "published",
  price_mode: "own",
  utilities_included: true,
  monthly_price: null,
  listing_source: "manual",
  external_id: null,
  mirror_content: true,
  calendar: { type: "manual", sync_status: "never" },
  ...p,
}));

// Busy periods relative to today so the demo always looks live. [propertyId, startOffsetDays, nights]
const today = startOfDay(new Date());
const d = (n: number) => format(addDays(today, n), "yyyy-MM-dd");
const busy: [string, number, number][] = [
  ["p1", 0, 20], ["p1", 75, 60], ["p2", 0, 48], ["p2", 260, 30], ["p3", 0, 50], ["p3", 160, 40],
  ["p4", 10, 30], ["p4", 120, 90], ["p5", 0, 46], ["p5", 110, 60], ["p6", 0, 53], ["p6", 140, 20],
  ["p7", 30, 120], ["p8", 0, 50], ["p8", 150, 20], ["p9", 5, 25], ["p10", 0, 100], ["p11", 40, 70], ["p12", 0, 15], ["p12", 60, 30],
];
export const blocks: AvailabilityBlock[] = busy.map(([pid, s, n], i) => ({
  id: `b${i}`, property_id: pid, start_date: d(s), end_date: d(s + n), source: "ical", summary: "Reserved",
}));

export const inquiries: Inquiry[] = [
  { id: "i1", property_id: "p1", from_name: "Anna Keller", from_email: "anna@example.com", from_organization_id: "o-sol", on_behalf_of_client: true, move_in: d(25), months: 2, guests: 4, message: "Client family from Germany looking for Jan–Feb. Is the price negotiable for 2 months?", status: "new", created_at: now },
  { id: "i2", property_id: "p2", from_name: "Tom Becker", from_email: "tom@example.com", from_organization_id: null, on_behalf_of_client: false, move_in: d(55), months: 3, guests: 1, message: "Remote worker, would love to stay 3 months.", status: "replied", created_at: now },
];

/** What the demo "PMS / MLS" returns when you connect it in the dashboard (demo mode only). */
export const demoRemote: Record<"guesty" | "resales" | "inmobalia", RemoteListing[]> = {
  guesty: [
    { external_id: "gst-6512a1", title: "Sea-view penthouse, Golden Mile", description: "Bright penthouse with wraparound terrace and open sea views.", photos: [img("1613490493576-7fde63acd811")], city: "Marbella", area: "Golden Mile", lat: 36.5068, lng: -4.9156, type: "apartment", bedrooms: 3, bathrooms: 2, max_guests: 6, size_m2: 140, amenities: AMEN.coast, nightly_rate: 210, monthly_rate: 5400 },
    { external_id: "gst-a01c55", title: "Puerto Banús 2BR with pool", description: "Walk to the marina, shops and beach clubs. Gated complex with two pools.", photos: [img("1600607687939-ce8a6c25118c"), img("1493809842364-78817add7ffb")], city: "Marbella", area: "Puerto Banús", lat: 36.4870, lng: -4.9530, type: "apartment", bedrooms: 2, bathrooms: 2, max_guests: 4, size_m2: 95, amenities: AMEN.coast, nightly_rate: 140, monthly_rate: 3600 },
    { external_id: "gst-b72e19", title: "Nueva Andalucía golf villa", description: "Family villa on Los Naranjos golf with private pool and garden.", photos: [img("1512917774080-9991f1c4c750"), img("1600585154340-be6161a56a0c")], city: "Marbella", area: "Nueva Andalucía", lat: 36.5010, lng: -4.9640, type: "villa", bedrooms: 4, bathrooms: 4, max_guests: 8, size_m2: 260, amenities: AMEN.villa, nightly_rate: 380, monthly_rate: null },
  ],
  resales: [
    { external_id: "R4512233", title: "Frontline 2BR, Los Boliches", description: "Beachfront apartment with sea-facing terrace on the promenade.", photos: [img("1586023492125-27b2c045efd7")], city: "Fuengirola", area: "Los Boliches", lat: 36.5867, lng: -4.6176, type: "apartment", bedrooms: 2, bathrooms: 2, max_guests: 4, size_m2: 85, amenities: AMEN.coast, monthly_rate: 1900 },
    { external_id: "R4533019", title: "Penthouse in Torremolinos centre", description: "Top-floor apartment with large solarium, 400 m to La Carihuela.", photos: [img("1560448204-e02f11c3d0e2")], city: "Torremolinos", lat: 36.6219, lng: -4.4999, type: "apartment", bedrooms: 2, bathrooms: 1, max_guests: 4, size_m2: 78, amenities: AMEN.coast, monthly_rate: 1500 },
  ],
  inmobalia: [
    { external_id: "INM-22841", title: "Old-town apartment with roof terrace", description: "Charming flat among the flower-pot streets.", photos: [img("1484154218962-a197022b5858")], city: "Estepona", area: "Casco Antiguo", lat: 36.4256, lng: -5.1459, type: "apartment", bedrooms: 2, bathrooms: 1, max_guests: 4, size_m2: 70, amenities: AMEN.city, monthly_rate: 1600 },
    { external_id: "INM-23122", title: "Duquesa port townhouse", description: "Three-storey townhouse steps from Puerto de la Duquesa.", photos: [img("1518780664697-55e3ad937233")], city: "Manilva", area: "La Duquesa", lat: 36.3570, lng: -5.2290, type: "house", bedrooms: 3, bathrooms: 2, max_guests: 6, size_m2: 130, amenities: AMEN.villa, monthly_rate: 2100 },
  ],
};
