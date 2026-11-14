import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Photo } from "@/components/Photo";
import { api } from "@/lib/api";

export default function Regions() {
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Areas on the Costa del Sol</h1>
      <p className="mb-6 mt-1 text-muted-foreground">Phase 1 covers Málaga to Sotogrande. More regions will follow.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {regions.map((r) => (
          <Link key={r.id} to={`/area/${r.slug}`} className="group flex overflow-hidden rounded-lg border bg-card hover:border-primary/50">
            <Photo src={r.image} alt={r.name} className="h-40 w-40 shrink-0" />
            <div className="p-5">
              <div className="text-xs text-muted-foreground">{r.country}</div>
              <div className="text-xl font-bold">{r.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{r.blurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
