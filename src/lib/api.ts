
import * as seed from "@/data/seed";
import { isAvailable } from "./availability";
import { parseICal } from "./ical";
import { matchRegion, remoteToProperty } from "./importMapping";
import { supabase } from "./supabase";
import { effectivePrice, slugify } from "./utils";
import type {
  AvailabilityBlock, Integration, IntegrationProvider, RemoteListing, Inquiry, InquiryStatus, Organization, Profile, Property, PropertyWithMeta, Region, SearchFilters, AccountType, Role,
} from "./types";

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  org_type: AccountType;
  org_name: string;
  city: string;
  country: string;
  phone?: string;
}

export interface DataApi {
  // auth
  currentProfile(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signUp(input: SignUpInput): Promise<Profile>;
  signOut(): Promise<void>;
  // read
  listRegions(): Promise<Region[]>;
  listOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | null>;
  search(filters: SearchFilters, viewer: Profile | null): Promise<PropertyWithMeta[]>;
  getProperty(slug: string): Promise<PropertyWithMeta | null>;
  // owner / agent workspace
  myProperties(orgId: string): Promise<PropertyWithMeta[]>;
  getPropertyById(id: string): Promise<PropertyWithMeta | null>;
  saveProperty(p: Partial<Property> & { organization_id: string }): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  addBlock(b: Omit<AvailabilityBlock, "id">): Promise<void>;
  removeBlock(id: string): Promise<void>;
  syncCalendar(propertyId: string): Promise<{ imported: number; error?: string }>;
  uploadPhoto(propertyId: string, file: File): Promise<string>;
  // inquiries
  createInquiry(i: Omit<Inquiry, "id" | "status" | "created_at">): Promise<void>;
  inboxFor(orgId: string): Promise<(Inquiry & { property?: Property })[]>;
  sentBy(orgId: string): Promise<(Inquiry & { property?: Property })[]>;
  setInquiryStatus(id: string, status: InquiryStatus): Promise<void>;
  // PMS / MLS integrations
  listIntegrations(orgId: string): Promise<Integration[]>;
  connectIntegration(orgId: string, provider: IntegrationProvider, credentials: Record<string, string>): Promise<Integration>;
  disconnectIntegration(orgId: string, provider: IntegrationProvider): Promise<void>;
  fetchRemoteListings(orgId: string, provider: IntegrationProvider): Promise<RemoteListing[]>;
  importRemoteListings(orgId: string, provider: IntegrationProvider, externalIds: string[]): Promise<{ created: number; updated: number }>;
}

/* ------------------------------------------------------------------ */
/* Shared filtering (used by demo mode; Supabase mode filters the same way after fetching) */

function applyFilters(list: PropertyWithMeta[], f: SearchFilters, viewer: Profile | null) {
  return list.filter((p) => {
    if (p.status !== "published") return false;
    if (p.visibility === "network" && !viewer) return false;
    if (f.region && p.region?.slug !== f.region) return false;
    if (f.guests && p.max_guests < f.guests) return false;
    const price = effectivePrice(p);
    if (f.maxPrice && price && price > f.maxPrice) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.months && (f.months < p.min_months || f.months > p.max_months)) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      if (![p.title, p.city, p.area, p.region?.name].some((s) => s?.toLowerCase().includes(q))) return false;
    }
    if (f.moveIn && !isAvailable(p.blocks, f.moveIn, f.months ?? p.min_months)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Demo implementation: everything lives in localStorage */

const KEY = "directstay-demo-v3";
interface DemoDb {
  regions: Region[]; organizations: Organization[]; properties: Property[]; blocks: AvailabilityBlock[]; inquiries: Inquiry[];
  profiles: (Profile & { password: string })[]; session: string | null;
  integrations: Record<string, Integration[]>;
}
function load(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const db: DemoDb = {
    regions: seed.regions, organizations: seed.organizations, properties: seed.properties, blocks: seed.blocks, inquiries: seed.inquiries,
    profiles: [{ id: "u-demo", email: "demo@directstay.app", password: "demo1234", full_name: "Demo Agent", role: "agent", organization_id: "o-cqre" }],
    session: null,
    integrations: {},
  };
  save(db);
  return db;
}
function save(db: DemoDb) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn("Demo storage full", e); }
}
const uid = () => Math.random().toString(36).slice(2, 10);
const strip = ({ password, ...p }: Profile & { password: string }): Profile => p;

function hydrate(db: DemoDb, p: Property): PropertyWithMeta {
  return {
    ...p,
    region: db.regions.find((r) => r.id === p.region_id),
    organization: db.organizations.find((o) => o.id === p.organization_id),
    blocks: db.blocks.filter((b) => b.property_id === p.id),
  };
}

async function downscale(file: File, max = 1400): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.75);
}

const demoApi: DataApi = {
  async currentProfile() {
    const db = load();
    const p = db.profiles.find((x) => x.id === db.session);
    return p ? strip(p) : null;
  },
  async signIn(email, password) {
    const db = load();
    const p = db.profiles.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!p) throw new Error("Wrong email or password. Demo login: demo@directstay.app / demo1234");
    db.session = p.id; save(db);
    return strip(p);
  },
  async signUp(i) {
    const db = load();
    if (db.profiles.some((x) => x.email.toLowerCase() === i.email.toLowerCase())) throw new Error("An account with this email already exists");
    const org: Organization = { id: "o-" + uid(), name: i.org_name || i.full_name, type: i.org_type, city: i.city, country: i.country, verified: false, email: i.email, phone: i.phone };
    const prof = { id: "u-" + uid(), email: i.email, password: i.password, full_name: i.full_name, role: i.role, organization_id: org.id };
    db.organizations.push(org); db.profiles.push(prof); db.session = prof.id; save(db);
    return strip(prof);
  },
  async signOut() { const db = load(); db.session = null; save(db); },
  async listRegions() { return load().regions; },
  async listOrganizations() { return load().organizations; },
  async getOrganization(id) { return load().organizations.find((o) => o.id === id) ?? null; },
  async search(f, viewer) { const db = load(); return applyFilters(db.properties.map((p) => hydrate(db, p)), f, viewer); },
  async getProperty(slug) { const db = load(); const p = db.properties.find((x) => x.slug === slug); return p ? hydrate(db, p) : null; },
  async getPropertyById(id) { const db = load(); const p = db.properties.find((x) => x.id === id); return p ? hydrate(db, p) : null; },
  async myProperties(orgId) { const db = load(); return db.properties.filter((p) => p.organization_id === orgId).map((p) => hydrate(db, p)); },
  async saveProperty(input) {
    const db = load();
    const existing = input.id ? db.properties.find((p) => p.id === input.id) : undefined;
    if (existing) { Object.assign(existing, input); save(db); return existing; }
    const id = "p-" + uid();
    const p: Property = {
      id, slug: `${slugify(input.title ?? "listing")}-${id}`, region_id: db.regions[0].id, title: "Untitled listing", city: "", type: "apartment",
      bedrooms: 1, bathrooms: 1, max_guests: 2, min_months: 1, max_months: 12, monthly_price: null, price_mode: "own", listing_source: "manual", mirror_content: false, utilities_included: true, agent_commission_pct: 10,
      description: "", amenities: [], photos: [], visibility: "public", status: "draft", calendar: { type: "manual", sync_status: "never" },
      created_at: new Date().toISOString(), ...input,
    } as Property;
    db.properties.push(p); save(db);
    return p;
  },
  async deleteProperty(id) { const db = load(); db.properties = db.properties.filter((p) => p.id !== id); db.blocks = db.blocks.filter((b) => b.property_id !== id); save(db); },
  async addBlock(b) { const db = load(); db.blocks.push({ ...b, id: "b-" + uid() }); save(db); },
  async removeBlock(id) { const db = load(); db.blocks = db.blocks.filter((b) => b.id !== id); save(db); },
  async syncCalendar(propertyId) {
    const db = load();
    const p = db.properties.find((x) => x.id === propertyId);
    if (!p) throw new Error("Listing not found");
    // Browsers can't fetch most iCal feeds (CORS), so demo mode simulates a sync.
    // With Supabase configured, the sync-calendars edge function fetches the real feed.
    let error: string | undefined;
    if (p.calendar.type === "ical" && p.calendar.ical_url) {
      try {
        const res = await fetch(p.calendar.ical_url);
        const events = parseICal(await res.text());
        db.blocks = db.blocks.filter((b) => !(b.property_id === p.id && b.source === "ical"));
        events.forEach((e) => db.blocks.push({ id: "b-" + uid(), property_id: p.id, start_date: e.start, end_date: e.end, source: "ical", summary: e.summary }));
        p.calendar = { ...p.calendar, sync_status: "ok", last_synced_at: new Date().toISOString(), sync_error: undefined };
        save(db);
        return { imported: events.length };
      } catch {
        error = "Demo mode: feed could not be fetched from the browser (CORS). The server-side sync will handle it once Supabase is connected.";
      }
    }
    p.calendar = { ...p.calendar, sync_status: error ? "pending" : "ok", last_synced_at: new Date().toISOString() };
    save(db);
    return { imported: 0, error };
  },
  async uploadPhoto(_pid, file) { return downscale(file); },
  async createInquiry(i) { const db = load(); db.inquiries.unshift({ ...i, id: "i-" + uid(), status: "new", created_at: new Date().toISOString() }); save(db); },
  async inboxFor(orgId) {
    const db = load();
    const mine = new Set(db.properties.filter((p) => p.organization_id === orgId).map((p) => p.id));
    return db.inquiries.filter((i) => mine.has(i.property_id)).map((i) => ({ ...i, property: db.properties.find((p) => p.id === i.property_id) }));
  },
  async sentBy(orgId) {
    const db = load();
    return db.inquiries.filter((i) => i.from_organization_id === orgId).map((i) => ({ ...i, property: db.properties.find((p) => p.id === i.property_id) }));
  },
  async setInquiryStatus(id, status) { const db = load(); const i = db.inquiries.find((x) => x.id === id); if (i) i.status = status; save(db); },
  async listIntegrations(orgId) { return load().integrations[orgId] ?? []; },
  async connectIntegration(orgId, provider, creds) {
    const db = load();
    const missing = Object.entries(creds).filter(([, v]) => !v?.trim()).map(([k]) => k);
    if (missing.length) throw new Error(`Please fill in: ${missing.join(", ")}`);
    const label = provider === "inmobalia" ? new URL(creds.feed_url).host : provider === "resales" ? `Agency ${creds.agency_id}` : `Client ${creds.client_id.slice(0, 6)}…`;
    const it: Integration = { provider, connected_at: new Date().toISOString(), status: "ok", label };
    db.integrations[orgId] = [...(db.integrations[orgId] ?? []).filter((x) => x.provider !== provider), it];
    save(db);
    return it;
  },
  async disconnectIntegration(orgId, provider) { const db = load(); db.integrations[orgId] = (db.integrations[orgId] ?? []).filter((x) => x.provider !== provider); save(db); },
  async fetchRemoteListings(orgId, provider) {
    const db = load();
    return seed.demoRemote[provider].map((r) => ({
      ...r,
      imported_property_id: db.properties.find((p) => p.organization_id === orgId && p.listing_source === provider && p.external_id === r.external_id)?.id ?? null,
    }));
  },
  async importRemoteListings(orgId, provider, ids) {
    const db = load();
    let created = 0, updated = 0;
    for (const r of seed.demoRemote[provider].filter((x) => ids.includes(x.external_id))) {
      const existing = db.properties.find((p) => p.organization_id === orgId && p.listing_source === provider && p.external_id === r.external_id);
      const region = matchRegion(r, db.regions) ?? db.regions[0];
      const patch = remoteToProperty(r, provider, existing, region.id);
      if (existing) { Object.assign(existing, patch); updated++; }
      else {
        const id = "p-" + uid();
        db.properties.push({ ...(patch as Property), id, slug: `${slugify(r.title)}-${id}`, organization_id: orgId, created_at: new Date().toISOString() });
        created++;
      }
    }
    const it = (db.integrations[orgId] ?? []).find((x) => x.provider === provider);
    if (it) it.last_import_at = new Date().toISOString();
    save(db);
    return { created, updated };
  },
};

/* ------------------------------------------------------------------ */
/* Supabase implementation. Tables & RLS: supabase/migrations/0001_init.sql */

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToProperty(r: any): PropertyWithMeta {
  const { calendar_type, ical_url, pms_provider, pms_listing_id, last_synced_at, sync_status, sync_error, regions, organizations, availability_blocks, ...rest } = r;
  return {
    ...rest,
    calendar: { type: calendar_type, ical_url, pms_provider, pms_listing_id, last_synced_at, sync_status, sync_error },
    region: regions ?? undefined,
    organization: organizations ?? undefined,
    blocks: availability_blocks ?? [],
  };
}
function propertyToRow(p: Partial<Property>) {
  const { calendar, ...rest } = p as any;
  delete rest.region; delete rest.organization; delete rest.blocks;
  return {
    ...rest,
    ...(calendar && {
      calendar_type: calendar.type, ical_url: calendar.ical_url ?? null, pms_provider: calendar.pms_provider ?? null,
      pms_listing_id: calendar.pms_listing_id ?? null,
    }),
  };
}
const SELECT = "*, regions(*), organizations(*), availability_blocks(*)";

function sbApi(sb: NonNullable<typeof supabase>): DataApi {
  const must = <T,>(res: { data: T; error: any }): T => { const { data, error } = res; if (error) throw new Error(error.message); return data; };
  return {
    async currentProfile() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      return must(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle()) as Profile | null;
    },
    async signIn(email, password) {
      const { error: authErr } = await sb.auth.signInWithPassword({ email, password }); if (authErr) throw new Error(authErr.message);
      const p = await this.currentProfile();
      if (!p) throw new Error("Profile missing");
      return p;
    },
    async signUp(i) {
      // Profile + organization are created by the handle_new_user() trigger from this metadata.
      const { error: upErr } = await sb.auth.signUp({ email: i.email, password: i.password, options: { data: { ...i, password: undefined } } }); if (upErr) throw new Error(upErr.message);
      const p = await this.currentProfile();
      if (!p) throw new Error("Check your inbox to confirm your email, then sign in.");
      return p;
    },
    async signOut() { await sb.auth.signOut(); },
    async listRegions() { return must(await sb.from("regions").select("*").order("name")) as Region[]; },
    async listOrganizations() { return must(await sb.from("organizations").select("*").order("name")) as Organization[]; },
    async getOrganization(id) { return must(await sb.from("organizations").select("*").eq("id", id).maybeSingle()) as Organization | null; },
    async search(f, viewer) {
      let q = sb.from("properties").select(SELECT).eq("status", "published");
      if (f.guests) q = q.gte("max_guests", f.guests);
      if (f.type) q = q.eq("type", f.type);
      const rows = must(await q) as any[];
      return applyFilters(rows.map(rowToProperty), f, viewer);
    },
    async getProperty(slug) { const r = must(await sb.from("properties").select(SELECT).eq("slug", slug).maybeSingle()); return r ? rowToProperty(r) : null; },
    async getPropertyById(id) { const r = must(await sb.from("properties").select(SELECT).eq("id", id).maybeSingle()); return r ? rowToProperty(r) : null; },
    async myProperties(orgId) { return (must(await sb.from("properties").select(SELECT).eq("organization_id", orgId).order("created_at", { ascending: false })) as any[]).map(rowToProperty); },
    async saveProperty(p) {
      const row = propertyToRow(p);
      if (!p.id) row.slug = `${slugify(p.title ?? "listing")}-${Math.random().toString(36).slice(2, 7)}`;
      const r = must(await sb.from("properties").upsert(row).select(SELECT).single());
      return rowToProperty(r);
    },
    async deleteProperty(id) { must(await sb.from("properties").delete().eq("id", id)); },
    async addBlock(b) { must(await sb.from("availability_blocks").insert(b)); },
    async removeBlock(id) { must(await sb.from("availability_blocks").delete().eq("id", id)); },
    async syncCalendar(propertyId) {
      const { data, error } = await sb.functions.invoke("sync-calendars", { body: { property_id: propertyId } });
      if (error) return { imported: 0, error: error.message };
      return { imported: data?.results?.[0]?.imported ?? 0, error: data?.results?.[0]?.error };
    },
    async uploadPhoto(propertyId, file) {
      const path = `${propertyId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-")}`;
      must(await sb.storage.from("property-photos").upload(path, file, { upsert: false }));
      return sb.storage.from("property-photos").getPublicUrl(path).data.publicUrl;
    },
    async createInquiry(i) { must(await sb.from("inquiries").insert(i)); },
    async inboxFor(orgId) {
      const rows = must(await sb.from("inquiries").select("*, properties!inner(*)").eq("properties.organization_id", orgId).order("created_at", { ascending: false })) as any[];
      return rows.map(({ properties, ...i }) => ({ ...i, property: properties }));
    },
    async sentBy(orgId) {
      const rows = must(await sb.from("inquiries").select("*, properties(*)").eq("from_organization_id", orgId).order("created_at", { ascending: false })) as any[];
      return rows.map(({ properties, ...i }) => ({ ...i, property: properties }));
    },
    async setInquiryStatus(id, status) { must(await sb.from("inquiries").update({ status }).eq("id", id)); },
    async listIntegrations(orgId) { return must(await sb.from("integrations_public").select("*").eq("organization_id", orgId)) as Integration[]; },
    // Credentials go to the pms-import edge function, which validates and stores them server side.
    async connectIntegration(_orgId, provider, credentials) { return call("connect", { provider, credentials }); },
    async disconnectIntegration(_orgId, provider) { await call("disconnect", { provider }); },
    async fetchRemoteListings(_orgId, provider) { return call("list", { provider }); },
    async importRemoteListings(_orgId, provider, external_ids) { return call("import", { provider, external_ids }); },
  };
  async function call(action: string, body: Record<string, unknown>) {
    const { data, error } = await sb.functions.invoke("pms-import", { body: { action, ...body } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }
}

export const api: DataApi = supabase ? sbApi(supabase) : demoApi;

export function resetDemo() { localStorage.removeItem(KEY); }
