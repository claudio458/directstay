import { Link } from "react-router-dom";
import { BedDouble, Lock, Maximize, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/Photo";
import { describeWindow, nextAvailable } from "@/lib/availability";
import type { PropertyWithMeta } from "@/lib/types";
import { effectivePrice, formatPrice } from "@/lib/utils";

export function PropertyCard({ p }: { p: PropertyWithMeta }) {
  const w = nextAvailable(p.blocks, p.min_months);
  return (
    <Link to={`/property/${p.slug}`} className="group overflow-hidden rounded-lg border bg-card transition hover:border-primary/50">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Photo src={p.photos[0]} alt={p.title} className="h-full w-full transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant={w ? "success" : "muted"} className="bg-background/85 backdrop-blur">{describeWindow(w)}</Badge>
          {p.visibility === "network" && <Badge className="bg-background/85 backdrop-blur"><Lock className="h-3 w-3" /> Network only</Badge>}
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="text-xs text-muted-foreground">{[p.area, p.city].filter(Boolean).join(", ")}</div>
        <h3 className="line-clamp-1 font-semibold">{p.title}</h3>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {p.size_m2 && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{p.size_m2} m²</span>}
          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{p.bedrooms} bd</span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.max_guests}</span>
          <span>{p.min_months}–{p.max_months} mo</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="font-semibold">{formatPrice(effectivePrice(p))}</span>
          {p.agent_commission_pct ? <span className="text-xs text-primary">{p.agent_commission_pct}% agent split</span> : null}
        </div>
      </div>
    </Link>
  );
}
