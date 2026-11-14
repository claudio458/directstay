import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type { AvailabilityBlock } from "./types";

export const iso = (d: Date) => format(d, "yyyy-MM-dd");

export interface FreeWindow {
  start: string;
  end: string; // exclusive; may equal horizon end
  openEnded: boolean;
}

/** Free windows from today until the horizon (default 12 months), given busy blocks. */
export function freeWindows(blocks: AvailabilityBlock[], horizonMonths = 12, from = startOfDay(new Date())): FreeWindow[] {
  const horizon = addMonths(from, horizonMonths);
  const sorted = [...blocks]
    .map((b) => ({ s: parseISO(b.start_date), e: parseISO(b.end_date) }))
    .filter((b) => b.e > from)
    .sort((a, b) => +a.s - +b.s);
  const out: FreeWindow[] = [];
  let cursor = from;
  for (const b of sorted) {
    if (b.s > cursor) out.push({ start: iso(cursor), end: iso(b.s < horizon ? b.s : horizon), openEnded: false });
    if (b.e > cursor) cursor = b.e;
    if (cursor >= horizon) break;
  }
  if (cursor < horizon) out.push({ start: iso(cursor), end: iso(horizon), openEnded: true });
  return out.filter((w) => differenceInCalendarDays(parseISO(w.end), parseISO(w.start)) >= 1);
}

/** True if [moveIn, moveIn + months) does not overlap any block. */
export function isAvailable(blocks: AvailabilityBlock[], moveIn: string, months: number) {
  const s = parseISO(moveIn);
  const e = addMonths(s, months);
  return !blocks.some((b) => parseISO(b.start_date) < e && parseISO(b.end_date) > s);
}

/** First free window that is long enough for minMonths. */
export function nextAvailable(blocks: AvailabilityBlock[], minMonths = 1): FreeWindow | undefined {
  return freeWindows(blocks).find(
    (w) => w.openEnded || addMonths(parseISO(w.start), minMonths) <= parseISO(w.end),
  );
}

export function isDayBusy(blocks: AvailabilityBlock[], day: Date) {
  const d = startOfDay(day);
  return blocks.some((b) => parseISO(b.start_date) <= d && parseISO(b.end_date) > d);
}

export function describeWindow(w?: FreeWindow) {
  if (!w) return "Fully booked";
  const s = format(parseISO(w.start), "d MMM");
  if (w.openEnded) return `Free from ${s}`;
  return `Free ${s} – ${format(addDays(parseISO(w.end), -1), "d MMM")}`;
}
