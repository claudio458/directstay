import type { IntegrationProvider, Property, Region, RemoteListing } from "./types";

/**
 * Town → area slug for the Costa del Sol. Used to put imported listings in the right area.
 * Keep in sync with supabase/functions/pms-import/index.ts. Add rows when expanding.
 */
export const TOWN_TO_AREA: Record<string, string> = {
  malaga: "malaga", "rincon de la victoria": "malaga",
  torremolinos: "torremolinos-benalmadena", benalmadena: "torremolinos-benalmadena", "arroyo de la miel": "torremolinos-benalmadena",
  fuengirola: "fuengirola-mijas", mijas: "fuengirola-mijas", "mijas costa": "fuengirola-mijas", "la cala de mijas": "fuengirola-mijas",
  marbella: "marbella", "puerto banus": "marbella", "nueva andalucia": "marbella", "san pedro de alcantara": "marbella", "elviria": "marbella",
  benahavis: "benahavis",
  estepona: "estepona", casares: "estepona",
  manilva: "manilva-sotogrande", sotogrande: "manilva-sotogrande", "san roque": "manilva-sotogrande", "la duquesa": "manilva-sotogrande",
  nerja: "nerja-axarquia", frigiliana: "nerja-axarquia", torrox: "nerja-axarquia", "velez-malaga": "nerja-axarquia",
};

const norm = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function matchRegion(r: Pick<RemoteListing, "city" | "area">, regions: Region[]): Region | undefined {
  const slug = TOWN_TO_AREA[norm(r.area)] ?? TOWN_TO_AREA[norm(r.city)];
  return regions.find((x) => x.slug === slug);
}

export const PMS_PROVIDERS: IntegrationProvider[] = ["guesty"];

/**
 * Builds the property fields from a remote listing.
 * - New listings arrive as drafts so the owner can check price and publish.
 * - PMS (Guesty): calendar is synced from the PMS; price defaults to the PMS rate (owner can switch to own price).
 * - MLS (Resales, Inmobalia): the MLS rental price becomes the owner's monthly price; calendar starts manual (owner can add iCal).
 * - Re-imports refresh content only while mirror_content is on, and never touch the owner's own price or status.
 */
export function remoteToProperty(r: RemoteListing, provider: IntegrationProvider, existing: Property | undefined, regionId: string): Partial<Property> {
  const isPms = PMS_PROVIDERS.includes(provider);
  const content: Partial<Property> = {
    title: r.title, description: r.description, photos: r.photos, city: r.city, area: r.area, lat: r.lat ?? null, lng: r.lng ?? null,
    type: r.type, bedrooms: r.bedrooms, bathrooms: r.bathrooms, max_guests: r.max_guests, size_m2: r.size_m2 ?? undefined, amenities: r.amenities,
    region_id: regionId,
  };
  const rates: Partial<Property> = { source_nightly_rate: r.nightly_rate ?? null, source_monthly_rate: r.monthly_rate ?? null };

  if (existing) {
    return { ...(existing.mirror_content ? content : {}), ...rates };
  }
  return {
    ...content, ...rates,
    listing_source: provider, external_id: r.external_id, mirror_content: true, status: "draft",
    price_mode: isPms && (r.nightly_rate || r.monthly_rate) ? "pms" : "own",
    monthly_price: isPms ? null : r.monthly_rate ?? null,
    min_months: 1, max_months: 12, utilities_included: true, agent_commission_pct: 10, visibility: "public",
    calendar: isPms
      ? { type: "pms", pms_provider: "guesty", pms_listing_id: r.external_id, sync_status: "pending" }
      : { type: "manual", sync_status: "never" },
  };
}
