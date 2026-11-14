import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Building2, User } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PropertyCard } from "@/components/PropertyCard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export function Network() {
  const { profile } = useAuth();
  const { data: orgs = [] } = useQuery({ queryKey: ["orgs"], queryFn: api.listOrganizations });
  const { data: props = [] } = useQuery({ queryKey: ["search", {}, profile?.id], queryFn: () => api.search({}, profile) });
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Agent network</h1>
      <p className="mb-8 mt-1 max-w-2xl text-muted-foreground">Agencies and owners who share their stock on DirectStay. Work together directly and agree the commission split between yourselves.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.map((o) => (
          <Link key={o.id} to={`/agency/${o.id}`}>
            <Card className="h-full p-5 transition hover:border-primary/50">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">{o.type === "agency" ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}</span>
                <div>
                  <div className="flex items-center gap-1 font-semibold">{o.name}{o.verified && <BadgeCheck className="h-4 w-4 text-primary" />}</div>
                  <div className="text-xs text-muted-foreground">{o.city}, {o.country}</div>
                </div>
              </div>
              {o.bio && <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{o.bio}</p>}
              <div className="flex gap-2">
                <Badge variant="muted">{o.type === "agency" ? "Agency" : "Private owner"}</Badge>
                <Badge>{props.filter((p) => p.organization_id === o.id).length} listings</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AgencyPage() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const { data: org } = useQuery({ queryKey: ["org", id], queryFn: () => api.getOrganization(id) });
  const { data: props = [] } = useQuery({ queryKey: ["search", {}, profile?.id], queryFn: () => api.search({}, profile) });
  if (!org) return <div className="container py-20 text-muted-foreground">Loading…</div>;
  const mine = props.filter((p) => p.organization_id === id);
  return (
    <div className="container py-10">
      <div className="mb-8">
        <div className="text-sm text-muted-foreground">{org.type === "agency" ? "Agency" : "Private owner"} · {org.city}, {org.country}</div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">{org.name}{org.verified && <BadgeCheck className="h-6 w-6 text-primary" />}</h1>
        {org.bio && <p className="mt-2 max-w-2xl text-muted-foreground">{org.bio}</p>}
        {profile ? (
          <div className="mt-3 flex gap-4 text-sm">
            <a className="text-primary" href={`mailto:${org.email}`}>{org.email}</a>
            {org.phone && <a className="text-primary" href={`tel:${org.phone}`}>{org.phone}</a>}
            {org.website && <a className="text-primary" href={org.website} target="_blank" rel="noreferrer">Website</a>}
          </div>
        ) : <p className="mt-3 text-sm text-muted-foreground"><Link className="text-primary" to="/auth">Sign in</Link> to see contact details.</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{mine.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
    </div>
  );
}
