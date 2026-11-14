import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface MapPin { id: string; lat: number; lng: number; label: string }

/** Interactive OpenStreetMap with price pins (Leaflet, no API key). */
export function MapView({ pins, activeId, onSelect, className }: { pins: MapPin[]; activeId?: string | null; onSelect?: (id: string | null) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: [36.55, -4.75], zoom: 10, scrollWheelZoom: true, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(m);
    m.on("click", () => select.current?.(null));
    map.current = m;
    const ro = new ResizeObserver(() => { if (map.current) m.invalidateSize({ animate: false }); });
    ro.observe(el.current);
    return () => { ro.disconnect(); m.stop(); m.off(); m.remove(); map.current = null; markers.current.clear(); };
  }, []);

  // Sync pins
  const key = pins.map((p) => `${p.id}:${p.label}`).join("|");
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current.clear();
    for (const p of pins) {
      const mk = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ html: `<div class="price-pin" data-pin="${p.id}">${p.label}</div>`, iconSize: [0, 0] }),
        keyboard: false,
      }).addTo(m);
      mk.on("click", (e) => { L.DomEvent.stopPropagation(e); select.current?.(p.id); });
      markers.current.set(p.id, mk);
    }
    if (pins.length) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [50, 50], maxZoom: 14, animate: false });
  }, [key]);

  // Highlight the active pin
  useEffect(() => {
    markers.current.forEach((mk, id) => {
      mk.getElement()?.querySelector(".price-pin")?.classList.toggle("active", id === activeId);
      mk.setZIndexOffset(id === activeId ? 1000 : 0);
    });
  }, [activeId, key]);

  return <div ref={el} className={cn("z-0 h-full w-full", className)} />;
}
