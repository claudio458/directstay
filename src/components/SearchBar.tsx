import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { CalendarDays, Clock, MapPin, Search, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { SearchFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

const months = Array.from({ length: 9 }, (_, i) => startOfMonth(addMonths(new Date(), i + 1)));

export function toParams(f: SearchFilters) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== null) p.set(k, String(v)); });
  return p;
}

function Field({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 items-center gap-3 px-4 py-3 md:border-r last:border-0">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex w-full flex-col">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        {children}
      </span>
    </label>
  );
}

const sel = "w-full bg-transparent text-sm font-medium outline-none [&>option]:bg-card";

export function SearchBar({ initial = {}, className }: { initial?: SearchFilters; className?: string }) {
  const nav = useNavigate();
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: api.listRegions });
  const [f, setF] = useState<SearchFilters>({ months: 3, guests: 2, ...initial });
  const set = (k: keyof SearchFilters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value === "" ? undefined : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); nav(`/search?${toParams(f)}`); }}
      className={cn("flex flex-col rounded-xl border bg-card/95 shadow-2xl backdrop-blur md:flex-row md:items-center", className)}
    >
      <Field icon={MapPin} label="Area">
        <select className={sel} value={f.region ?? ""} onChange={set("region")}>
          <option value="">All Costa del Sol</option>
          {regions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
        </select>
      </Field>
      <Field icon={CalendarDays} label="Move-in">
        <select className={sel} value={f.moveIn ?? ""} onChange={set("moveIn")}>
          <option value="">Flexible</option>
          {months.map((m) => <option key={+m} value={format(m, "yyyy-MM-dd")}>{format(m, "MMMM yyyy")}</option>)}
        </select>
      </Field>
      <Field icon={Clock} label="Stay">
        <select className={sel} value={f.months ?? ""} onChange={set("months")}>
          {[1, 2, 3, 4, 5, 6, 9, 12].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}
        </select>
      </Field>
      <Field icon={Users} label="Guests">
        <select className={sel} value={f.guests ?? ""} onChange={set("guests")}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>{g} guest{g > 1 ? "s" : ""}</option>)}
        </select>
      </Field>
      <div className="p-2"><Button type="submit" size="lg" variant="gold" className="w-full md:w-auto"><Search /> Search</Button></div>
    </form>
  );
}
