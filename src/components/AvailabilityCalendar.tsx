import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isBefore, startOfDay, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isDayBusy } from "@/lib/availability";
import type { AvailabilityBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

function Month({ month, blocks }: { month: Date; blocks: AvailabilityBlock[] }) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const offset = (getDay(days[0]) + 6) % 7; // Monday first
  const today = startOfDay(new Date());
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="text-muted-foreground">{d}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={"e" + i} />)}
        {days.map((d) => {
          const past = isBefore(d, today);
          const busy = isDayBusy(blocks, d);
          return (
            <div key={+d} className={cn("rounded py-1", past ? "text-muted-foreground/40" : busy ? "bg-destructive/20 text-destructive line-through" : "bg-success/15 text-success")}>
              {format(d, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AvailabilityCalendar({ blocks, months = 3 }: { blocks: AvailabilityBlock[]; months?: number }) {
  const [start, setStart] = useState(startOfMonth(new Date()));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/40" /> Available</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/40" /> Booked</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setStart(addMonths(start, -1))} disabled={start <= startOfMonth(new Date())}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" onClick={() => setStart(addMonths(start, 1))}><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: months }, (_, i) => <Month key={i} month={addMonths(start, i)} blocks={blocks} />)}
      </div>
    </div>
  );
}
