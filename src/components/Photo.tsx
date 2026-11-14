import { useState } from "react";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

/** Image with a branded placeholder when the URL is missing or fails to load. */
export function Photo({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400 text-white", className)}>
        <Home className="h-8 w-8 opacity-50" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}
