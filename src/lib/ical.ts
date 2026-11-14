/**
 * Minimal iCal (RFC 5545) VEVENT parser. Good enough for Airbnb, Booking.com,
 * VRBO, Guesty, Smoobu, Hostaway exports, which only use DTSTART/DTEND/SUMMARY.
 * The same logic runs server-side in supabase/functions/sync-calendars.
 */
export interface ParsedEvent {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD exclusive
  summary?: string;
  uid?: string;
}

function toDate(v: string) {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseICal(text: string): ParsedEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events: ParsedEvent[] = [];
  for (const chunk of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = chunk.split("END:VEVENT")[0];
    const get = (k: string) => body.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "m"))?.[1]?.trim();
    const start = toDate(get("DTSTART") ?? "");
    let end = toDate(get("DTEND") ?? "");
    if (!start) continue;
    if (!end) {
      const d = new Date(start + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      end = d.toISOString().slice(0, 10);
    }
    events.push({ start, end, summary: get("SUMMARY"), uid: get("UID") });
  }
  return events;
}
