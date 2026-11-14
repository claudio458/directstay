export type Role = "agent" | "owner" | "admin";
export type AccountType = "agency" | "private";
export type PropertyType = "apartment" | "villa" | "house" | "chalet" | "studio";
export type Visibility = "public" | "network";
export type PropertyStatus = "draft" | "published" | "paused";
export type CalendarSourceType = "ical" | "pms" | "manual";
export type PmsProvider = "guesty" | "hostaway" | "smoobu" | "lodgify" | "other";
/** Where a listing's content comes from. */
export type ListingSource = "manual" | "guesty" | "resales" | "inmobalia";
export type IntegrationProvider = "guesty" | "resales" | "inmobalia";
/** own = the owner's monthly price; pms = derived from the PMS nightly rate. */
export type PriceMode = "own" | "pms";
export type SyncStatus = "ok" | "error" | "pending" | "never";
export type InquiryStatus = "new" | "replied" | "closed";

export interface Region {
  id: string;
  slug: string;
  name: string;
  country: string;
  image: string;
  blurb: string;
}

/** An agency or a private owner. Every listing belongs to one. */
export interface Organization {
  id: string;
  name: string;
  type: AccountType;
  city: string;
  country: string;
  verified: boolean;
  email: string;
  phone?: string;
  website?: string;
  bio?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  organization_id: string;
}

export interface CalendarSource {
  type: CalendarSourceType;
  ical_url?: string;
  pms_provider?: PmsProvider;
  pms_listing_id?: string;
  last_synced_at?: string;
  sync_status: SyncStatus;
  sync_error?: string;
}

export interface Property {
  id: string;
  slug: string;
  organization_id: string;
  region_id: string;
  title: string;
  city: string;
  area?: string;
  type: PropertyType;
  size_m2?: number;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  min_months: number;
  max_months: number;
  /** Owner-set monthly rent (used when price_mode = "own"). */
  monthly_price?: number | null;
  price_mode: PriceMode;
  /** Mirrored from the PMS / MLS on every import. */
  source_nightly_rate?: number | null;
  source_monthly_rate?: number | null;
  utilities_included: boolean;
  /** B2B: commission (% of rent) the listing agency shares with the agency that brings the tenant. */
  agent_commission_pct?: number | null;
  description: string;
  amenities: string[];
  photos: string[];
  /** Approximate location (mirrored from PMS/MLS or set by owner). */
  lat?: number | null;
  lng?: number | null;
  /** Content source. Imported listings keep title/description/photos/location in sync while mirror_content is true. */
  listing_source: ListingSource;
  external_id?: string | null;
  mirror_content: boolean;
  visibility: Visibility;
  status: PropertyStatus;
  calendar: CalendarSource;
  created_at: string;
}

/** A busy period imported from iCal / PMS or entered manually. end is exclusive (checkout day). */
export interface AvailabilityBlock {
  id: string;
  property_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD, exclusive
  source: CalendarSourceType;
  summary?: string;
}

export interface Inquiry {
  id: string;
  property_id: string;
  from_name: string;
  from_email: string;
  from_phone?: string;
  from_organization_id?: string | null;
  on_behalf_of_client: boolean;
  move_in: string;
  months: number;
  guests: number;
  message: string;
  status: InquiryStatus;
  created_at: string;
}

export interface SearchFilters {
  region?: string; // region slug
  moveIn?: string; // YYYY-MM-DD
  months?: number;
  guests?: number;
  maxPrice?: number;
  type?: PropertyType | "";
  q?: string;
  onlyAvailable?: boolean;
}

export interface PropertyWithMeta extends Property {
  region?: Region;
  organization?: Organization;
  blocks: AvailabilityBlock[];
}

export interface Integration {
  provider: IntegrationProvider;
  connected_at: string;
  last_import_at?: string | null;
  status: "ok" | "error";
  error?: string | null;
  /** Non-secret hint, e.g. "Agency 1234" or the feed host. Secrets are never sent back to the browser. */
  label?: string;
}

/** A listing as read from a PMS or MLS, normalised. */
export interface RemoteListing {
  external_id: string;
  title: string;
  description: string;
  photos: string[];
  city: string;
  area?: string;
  lat?: number | null;
  lng?: number | null;
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  size_m2?: number | null;
  amenities: string[];
  nightly_rate?: number | null;
  monthly_rate?: number | null;
  /** Set by the server when this listing already exists in DirectStay. */
  imported_property_id?: string | null;
}
