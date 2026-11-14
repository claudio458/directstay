import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { List, Map as MapIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { MapView } from "@/components/MapView";
import { PropertyCard } from "@/components/PropertyCard";
import { toParams } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { PropertyType, SearchFilters } from "@/lib/types";
import { cn, effectivePrice } from "@/lib/utils";

const MONTHS = Array.from({ length: 9 }, (_, i) => startOfMonth(addMonths(new Date(), i + 1)));
const pinLabel = (n: number | null) => (n ? (n >= 1000 ? `€${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : `€${n}`) : "Ask");

export default function SearchPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const [active, setActive] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [mobileMap, setMobileMap] = useState(false);

  const filters: SearchFilters = useMemo(() => {
    const n = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
    return {
      region: params.get("region") ?? slug ?? undefined,
      moveIn: params.get("moveIn") ?? undefined,
      months: n("months"),
      guests: n("guests"),
      bedrooms: n("bedrooms"),
      maxPrice: n("maxPrice"),
      type: (params.get("type") as PropertyType) ?? "",
      sort: (params.get("sort") as SearchFilters["sort"]) ?? undefined,
      q: params.get("q") ?? undefined,
    };
  }, [params, slug]);

  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  const { data = [], isLoading } = useQuery({ queryKey: ["search", filters, profile?.id], queryFn: () => api.search(filters, profile) });
  const region = regions.find((r) => r.slug === filters.region);
  const update = (patch: Partial<SearchFilters>) => setParams(toParams({ ...filters, ...patch }), { replace: true });
  const sel = (k: keyof SearchFilters, numeric = false) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    update({ [k]: e.target.value === "" ? undefined : numeric ? Number(e.target.value) : e.target.value });
  const activeCount = ["region", "moveIn", "months", "guests", "bedrooms", "maxPrice", "type"].filter((k) => filters[k as keyof SearchFilters]).length;

  const pins = useMemo(
    () => data.filter((p) => p.lat && p.lng).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, label: pinLabel(effectivePrice(p)) })),
    [data],
  );
  const selected = data.find((p) => p.id === active);
  useEffect(() => {
    if (active) document.querySelector(`[data-card="${active}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Filter bar */}
      <div className="border-b bg-background">
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [&>*]:shrink-0">
          <Select className="w-52" value={filters.region ?? ""} onChange={sel("region")} aria-label="Area">
            <option value="">All Costa del Sol</option>
            {regions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
          </Select>
          <Select className="w-40" value={filters.moveIn ?? ""} onChange={sel("moveIn")} aria-label="Move-in">
            <option value="">Move-in: flexible</option>
            {MONTHS.map((m) => <option key={+m} value={format(m, "yyyy-MM-dd")}>{format(m, "MMM yyyy")}</option>)}
          </Select>
          <Select className="w-36" value={filters.months ?? ""} onChange={sel("months", true)} aria-label="Stay">
            <option value="">Any stay</option>
            {[1, 2, 3, 4, 5, 6, 9, 12].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
          </Select>
          <Select className="w-36" value={filters.bedrooms ?? ""} onChange={sel("bedrooms", true)} aria-label="Bedrooms">
            <option value="">Bedrooms</option>
            {[1, 2, 3, 4, 5].map((b) => <option key={b} value={b}>{b}+ bedrooms</option>)}
          </Select>
          <Select className="w-32" value={filters.guests ?? ""} onChange={sel("guests", true)} aria-label="Guests">
            <option value="">Guests</option>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((g) => <option key={g} value={g}>{g}+ guests</option>)}
          </Select>
          <Select className="w-40" value={filters.maxPrice ?? ""} onChange={sel("maxPrice", true)} aria-label="Price">
            <option value="">Any price</option>
            {[1500, 2500, 4000, 6000, 10000].map((v) => <option key={v} value={v}>Up to €{v.toLocaleString("en-GB")}</option>)}
          </Select>
          <Select className="w-36" value={filters.type ?? ""} onChange={sel("type")} aria-label="Type">
            <option value="">Any type</option>
            {["apartment", "studio", "house", "villa", "chalet"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
          {activeCount > 0 && <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}><X />Clear</Button>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className={cn("w-full overflow-y-auto p-4 lg:w-[56%] xl:w-[52%]", mobileMap && "hidden lg:block")}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">{isLoading ? "Searching…" : `${data.length} home${data.length === 1 ? "" : "s"} in ${region?.name ?? "Costa del Sol"}`}</h1>
              <p className="text-sm text-muted-foreground">
                Live availability from the managers' calendars. No platform fee.
                {!profile && " Sign in to see members-only homes and contact details."}
              </p>
            </div>
            <Select className="w-44" value={filters.sort ?? ""} onChange={sel("sort")} aria-label="Sort">
              <option value="">Available soonest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </Select>
          </div>
          {data.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              No home is free for these filters. Try another move-in month, a shorter stay or fewer bedrooms.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.map((p) => <PropertyCard key={p.id} p={p} active={p.id === active} onHover={setHover} />)}
            </div>
          )}
        </div>

        {/* Map */}
        <div className={cn("relative flex-1 border-l", mobileMap ? "block" : "hidden lg:block")}>
          <MapView pins={pins} activeId={active ?? hover} onSelect={setActive} />
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-md rounded-xl bg-card shadow-xl">
              <PropertyCard p={selected} compact />
              <button aria-label="Close" onClick={() => setActive(null)} className="absolute right-2 top-2 rounded-full bg-white p-1 shadow"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      </div>

      <Button className="fixed bottom-5 left-1/2 z-[600] -translate-x-1/2 rounded-full shadow-xl lg:hidden" onClick={() => setMobileMap(!mobileMap)}>
        {mobileMap ? <><List />List</> : <><MapIcon />Map</>}
      </Button>
    </div>
  );
}
