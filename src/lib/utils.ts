import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatPrice(eur: number | null | undefined) {
  if (!eur) return "Price on request";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(eur) + " / month";
}

import type { Property } from "./types";

/** The monthly price shown to members, respecting the owner's price mode. */
export function effectivePrice(p: Pick<Property, "price_mode" | "monthly_price" | "source_monthly_rate" | "source_nightly_rate">) {
  if (p.price_mode === "pms") return p.source_monthly_rate ?? (p.source_nightly_rate ? Math.round(p.source_nightly_rate * 30) : null);
  return p.monthly_price ?? null;
}

/** What a referring agent earns per month on this listing (commission % of the monthly rent). */
export function commissionPerMonth(p: Parameters<typeof effectivePrice>[0] & Pick<Property, "agent_commission_pct">) {
  const price = effectivePrice(p);
  return price && p.agent_commission_pct ? Math.round((price * p.agent_commission_pct) / 100) : null;
}

export const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
export const CHANNEL_LABEL = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "VRBO" } as const;
