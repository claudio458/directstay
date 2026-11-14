import { addMonths, format, startOfMonth } from "date-fns";
import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { isAvailable, nextAvailable } from "@/lib/availability";
import type { PropertyWithMeta } from "@/lib/types";

export function InquiryForm({ p }: { p: PropertyWithMeta }) {
  const { profile, organization } = useAuth();
  const first = nextAvailable(p.blocks, p.min_months);
  const [f, setF] = useState({
    from_name: profile?.full_name ?? "",
    from_email: profile?.email ?? "",
    from_phone: "",
    move_in: first?.start ?? format(startOfMonth(addMonths(new Date(), 1)), "yyyy-MM-dd"),
    months: p.min_months,
    guests: Math.min(2, p.max_guests),
    on_behalf_of_client: profile?.role === "agent",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const ok = isAvailable(p.blocks, f.move_in, f.months);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "number" || k === "months" || k === "guests" ? Number(e.target.value) : e.target.value });

  if (sent) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/10 p-5 text-sm">
        <div className="font-semibold text-success">Inquiry sent</div>
        <p className="mt-1 text-muted-foreground">{p.organization?.name ?? "The owner"} will reply to {f.from_email} directly.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.createInquiry({ ...f, property_id: p.id, from_organization_id: organization?.id ?? null });
          setSent(true);
          toast.success("Inquiry sent");
        } catch (err) {
          toast.error((err as Error).message);
        } finally { setBusy(false); }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Move-in</Label><Input type="date" required value={f.move_in} onChange={set("move_in")} /></div>
        <div className="space-y-1">
          <Label>Months</Label>
          <Select value={f.months} onChange={set("months")}>
            {Array.from({ length: p.max_months - p.min_months + 1 }, (_, i) => p.min_months + i).map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </div>
      </div>
      <div className={ok ? "text-xs text-success" : "text-xs text-destructive"}>{ok ? "Available for these dates" : "Not available for the full period. You can still ask."}</div>
      <div className="space-y-1"><Label>Guests</Label><Input type="number" min={1} max={p.max_guests} value={f.guests} onChange={set("guests")} /></div>
      {!profile && (
        <>
          <div className="space-y-1"><Label>Name</Label><Input required value={f.from_name} onChange={set("from_name")} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" required value={f.from_email} onChange={set("from_email")} /></div>
          <div className="space-y-1"><Label>Phone (optional)</Label><Input value={f.from_phone} onChange={set("from_phone")} /></div>
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.on_behalf_of_client} onChange={(e) => setF({ ...f, on_behalf_of_client: e.target.checked })} className="accent-[hsl(var(--primary))]" />
        I'm an agent asking for a client
      </label>
      <div className="space-y-1"><Label>Message</Label><Textarea required placeholder="Who is the tenant, purpose of stay, any questions…" value={f.message} onChange={set("message")} /></div>
      <Button type="submit" className="w-full" disabled={busy}><Send /> Send inquiry</Button>
      {profile && <p className="text-xs text-muted-foreground">Sent as {profile.full_name}{organization ? `, ${organization.name}` : ""}.</p>}
    </form>
  );
}
