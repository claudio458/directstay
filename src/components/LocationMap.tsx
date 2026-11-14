import { cn } from "@/lib/utils";

/** Keyless OpenStreetMap embed. Swap for Mapbox / Google Maps later if needed. */
export function LocationMap({ lat, lng, className, zoom = 0.01 }: { lat: number; lng: number; className?: string; zoom?: number }) {
  const bbox = [lng - zoom, lat - zoom * 0.6, lng + zoom, lat + zoom * 0.6].join(",");
  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <iframe
        title="Map"
        className="h-full w-full"
        loading="lazy"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
      />
    </div>
  );
}
