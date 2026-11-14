import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PropertyCard } from "@/components/PropertyCard";
import { SearchBar, toParams } from "@/components/SearchBar";
import { Input, Select } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { PropertyType, SearchFilters } from "@/lib/types";

export default function SearchPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const filters: SearchFilters = useMemo(() => {
    const n = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
    return {
      region: slug ?? params.get("region") ?? undefined,
      moveIn: params.get("moveIn") ?? undefined,
      months: n("months"),
      guests: n("guests"),
      maxPrice: n("maxPrice"),
      type: (params.get("type") as PropertyType) ?? "",
      q: params.get("q") ?? undefined,
    };
  }, [params, slug]);

  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  const { data = [], isLoading } = useQuery({ queryKey: ["search", filters, profile?.id], queryFn: () => api.search(filters, profile) });
  const region = regions.find((r) => r.slug === filters.region);
  const update = (patch: Partial<SearchFilters>) => setParams(toParams({ ...filters, ...patch, region: slug ? undefined : filters.region ?? undefined }));

  return (
    <div className="container py-8">
      {region && slug ? (
        <div className="mb-6">
          <div className="text-sm text-muted-foreground">{region.country}</div>
          <h1 className="text-3xl font-bold">{region.name}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{region.blurb}</p>
        </div>
      ) : (
        <h1 className="mb-6 text-3xl font-bold">Find available properties</h1>
      )}
      <SearchBar key={params.toString() + slug} initial={filters} className="mb-6" />
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <Select className="w-40" value={filters.type ?? ""} onChange={(e) => update({ type: e.target.value as PropertyType })}>
          <option value="">Any type</option>
          {["apartment", "studio", "house", "villa", "chalet"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </Select>
        <Select className="w-44" value={filters.maxPrice ?? ""} onChange={(e) => update({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Any price</option>
          {[1500, 2500, 4000, 6000, 10000].map((v) => <option key={v} value={v}>Up to €{v.toLocaleString()}</option>)}
        </Select>
        <Input className="w-56" placeholder="City, area or keyword" defaultValue={filters.q} onKeyDown={(e) => e.key === "Enter" && update({ q: (e.target as HTMLInputElement).value || undefined })} />
        <span className="ml-auto text-muted-foreground">{isLoading ? "Loading…" : `${data.length} propert${data.length === 1 ? "y" : "ies"}`}</span>
      </div>
      {!profile && <p className="mb-4 text-xs text-muted-foreground">Some listings are shared with network members only. Sign in to see them.</p>}
      {data.length === 0 && !isLoading ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No property is free for these dates. Try another move-in month or a shorter stay.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
