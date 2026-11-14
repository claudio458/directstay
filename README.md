# DirectStay Exchange

Free, commission-free exchange for **mid-term and winter rentals on the Costa del Sol**.
Agencies and private owners list furnished properties once, availability stays in sync with their PMS or Airbnb / Booking.com calendars, and other members search what is really free and contact the listing agency directly.

**Positioning:** B2B for property managers and agents. Members share the homes they already advertise on Airbnb / Booking.com; an agent's client books direct with the manager, pays **no platform fee**, and the agent earns the **commission** the manager set on the listing (`agent_commission_pct`). Search UX is map + list with price pins and filters (bedrooms, price, type, dates), in our own navy/gold branding.

Phase 1 scope (from the product owner):

- Costa del Sol only (8 areas, Málaga → Sotogrande). The `regions` table has a `country` column, so other regions can be added later without schema changes.
- Mirror listing info from a **PMS (Guesty)**: photos, calendar, prices, description, location.
- Owners log in, list properties, and **choose their own monthly price** or use the PMS rate, per listing.
- Owners **without a PMS**: Airbnb / Booking.com / VRBO **iCal**, or import from Spanish MLS/CRMs **Resales Online** and **Inmobalia**.
- Free and simple: no payments, no booking engine. Contact happens by inquiry + email/phone.

The developer SOP and roadmap: https://claude.ai/artifact/4E4D25KLXphAvJgu6TPjCU

## Stack

Vite · React 18 · TypeScript · Tailwind · shadcn-style UI (`src/components/ui`) · TanStack Query · React Router · Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron). Same stack Lovable generates, so the repo can be opened in Lovable directly.

## Run it

```bash
npm install
npm run dev        # http://localhost:8080
```

Without Supabase keys the app runs in **demo mode**: sample data (12 listings, 4 agencies) is stored in the browser's localStorage, and every flow works, including PMS/MLS import with sample listings.
Demo login: `demo@directstay.app` / `demo1234` (pre-filled on the sign-in page). "Reset demo data" is at the bottom of the dashboard.

## Open in Lovable

1. Lovable → New project → **Import from GitHub** → `claudio458/directstay`.
2. Lovable → **Supabase** → connect a project. Lovable sets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; the app switches from demo mode to live automatically (`src/lib/supabase.ts`).
3. Run the SQL below once (Lovable can apply migrations, or use the Supabase SQL editor).

## Supabase setup (go live)

1. **Schema**: run `supabase/migrations/0001_init.sql`, then `0003_imports_and_pricing.sql` and `0005_listed_on.sql`.
2. **Demo data (optional)**: `supabase/seed.sql` (regenerate with `node scripts/make-seed-sql.mjs`).
3. **Edge functions**:
   ```bash
   supabase functions deploy sync-calendars
   supabase functions deploy pms-import
   ```
   They use the built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; no extra secrets needed (PMS credentials are stored per agency in the `integrations` table).
4. **Schedules**: enable `pg_cron` and `pg_net`, fill in project ref + service key, then run `0002_cron.sql` (calendar sync every 15 min) and `0004_cron_imports.sql` (nightly content/price refresh).
5. **Auth**: Email + password. Sign-up metadata creates the organization and profile (`handle_new_user` trigger). Set the Site URL / redirect URLs to your domain.
6. **Hosting**: Lovable publish, or Netlify (`netlify.toml` included, SPA redirect set).

## How the pieces fit

| Feature | Where |
|---|---|
| Pages and routes | `src/App.tsx`, `src/pages/*` |
| Data access (demo + Supabase, one interface) | `src/lib/api.ts` |
| Map + list search (Leaflet, OpenStreetMap/CARTO tiles, no API key) | `src/pages/Search.tsx`, `src/components/MapView.tsx` |
| Booking request box with fee/commission breakdown | `src/components/InquiryForm.tsx` |
| Availability maths (free windows, "available for X months from date") | `src/lib/availability.ts` |
| iCal parser | `src/lib/ical.ts` and `supabase/functions/sync-calendars` |
| PMS/MLS → listing mapping rules | `src/lib/importMapping.ts` and `supabase/functions/pms-import` (keep both in sync) |
| Import UI (connect Guesty / Resales / Inmobalia, pick listings) | `src/pages/dashboard/ImportListings.tsx` |
| Listing wizard (details → calendar → photos → publish, own price vs PMS rate) | `src/pages/dashboard/ListingEditor.tsx` |
| Schema + row level security | `supabase/migrations/` |

### Import rules

- Imported listings arrive as **drafts**; the owner checks the price and publishes.
- `mirror_content = true` (default): title, description, photos, location, specs refresh on every import. Owners can switch it off per listing to keep their own edits.
- Rates from the source (`source_nightly_rate`, `source_monthly_rate`) always refresh. The price members see is `effectivePrice()`: the owner's `monthly_price` when `price_mode = 'own'`, otherwise the PMS monthly rate or nightly × 30.
- Guesty listings get `calendar_type = 'pms'` (calendar synced from Guesty). MLS listings start with a manual calendar; owners can add an iCal link.
- Towns are mapped to areas with `TOWN_TO_AREA`; unknown towns fall back to Málaga. Extend the table when adding towns.

### Integrations: what to verify with real accounts

- **Guesty Open API**: OAuth client credentials (`/oauth2/token`, cache the token, Guesty rate-limits token requests), `/v1/listings`, `/v1/availability-pricing/api/calendar/listings/{id}`. Confirm field names on a real account (`publicDescription`, `pictures[].original`, `address.lat/lng`, `prices.basePrice`, `prices.monthlyPriceFactor`).
- **Resales Online Web API V6**: `SearchProperties` + `PropertyDetails` with `p1` (agency), `p2` (key), `P_ApiId` (a filter containing only rentals). Resales requires whitelisting the caller IP; Supabase Edge Functions don't have a fixed IP, so you may need a small proxy with a static IP. Field names (`GpsX/GpsY`, `Pictures.Picture[].PictureURL`, rental price fields) should be checked against the agency's API output.
- **Inmobalia**: imported through its Kyero v3 XML export (any Kyero feed works, so other Spanish CRMs are covered too). Sale listings (`price_freq = sale`) are skipped; weekly prices × 4.3.
- **iCal**: Airbnb, Booking.com, VRBO, Google exports. Busy periods from the feed replace earlier imported blocks; manual blocks are kept.

## Known gaps / next steps (phase 1 → 2)

- **Contact details privacy**: `organizations` is readable by everyone (the UI hides email/phone for anonymous users). Before launch, move contact fields to a view for authenticated users only.
- **Calendar sync endpoint** accepts `{property_id}` without auth (it only refreshes data). Add a JWT check if that matters.
- **Email notifications** for new inquiries (Supabase webhook → Resend/Postmark).
- **Admin**: verify agencies (`organizations.verified`), moderate listings.
- **Translations**: UI is English; add `es` and `de` (i18next) since the original site was German.
- **More PMS**: Hostaway, Smoobu, Lodgify adapters (same `(integration) => RemoteListing[]` signature).
- **Bookings**: a booking request is an inquiry today. Next: accept/decline, contract, and commission tracking per booking (nothing is paid through the platform).
- **Search as the map moves** (bounds filter) and saved searches for agents.
- Images in the demo come from Unsplash; real listings use Supabase Storage (`property-photos` bucket) or the PMS photo URLs.
