import { Link } from "react-router-dom";
import { BedDouble, Lock, Maximize, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/Photo";
import { describeWindow, nextAvailable } from "@/lib/availability";
import type { PropertyWithMeta } from "@/lib/types";
import { CHANNEL_LABEL, cn, commissionPerMonth, effectivePrice, eur } from "@/lib/utils";

export function PropertyCard({ p, active, onHover, compact }: { p: PropertyWithMeta; active?: boolean; onHover?: (id: string | null) => void; compact?: boolean }) {
  const w = nextAvailable(p.blocks, p.min_months);
  const price = effectivePrice(p);
  const commission = commissionPerMonth(p);
  return (
    <Link
      to={`/property/${p.slug}`}
      data-card={p.id}
      onMouseEnter={() => onHover?.(p.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn("group overflow-hidden rounded-xl border bg-card shadow-sm transition hover:shadow-lg", active && "ring-2 ring-primary", compact && "flex")}
    >
      <div className={cn("relative overflow-hidden", compact ? "w-32 shrink-0" : "aspect-[4/3]")}>
        <Photo src={p.photos[0]} alt={p.title} className="h-full w-full transition duration-500 group-hover:scale-105" />
        {!compact && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge variant={w ? "success" : "muted"} className="bg-white/95 shadow-sm">{describeWindow(w)}</Badge>
            {p.visibility === "network" && <Badge className="bg-white/95 shadow-sm"><Lock className="h-3 w-3" /> Members only</Badge>}
          </div>
        )}
      </div>
      <div className={cn("space-y-1.5", compact ? "p-3" : "p-4")}>
        <div className="text-xs text-muted-foreground">{[p.type[0].toUpperCase() + p.type.slice(1), p.area, p.city].filter(Boolean).join(" · ")}</div>
        <h3 className="line-clamp-1 font-semibold">{p.title}</h3>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{p.bedrooms} bed</span>
          {p.size_m2 && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{p.size_m2} m²</span>}
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.max_guests}</span>
          {!compact && <span>{p.min_months}–{p.max_months} months</span>}
        </div>
        <div className="flex items-end justify-between gap-2 pt-1">
          <div>
            <span className="text-lg font-bold">{price ? eur(price) : "On request"}</span>
            {price && <span className="text-sm text-muted-foreground"> /month</span>}
          </div>
          {commission ? (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-foreground">Earn {eur(commission)}/mo</span>
          ) : p.agent_commission_pct ? (
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-foreground">{p.agent_commission_pct}% commission</span>
          ) : null}
        </div>
        {!compact && (
          <div className="text-xs text-muted-foreground">
            No platform fee{p.listed_on?.length ? ` · also on ${p.listed_on.map((c) => CHANNEL_LABEL[c]).join(", ")}` : ""}
          </div>
        )}
      </div>
    </Link>
  );
}
