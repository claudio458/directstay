import { CalendarClock, Check, Handshake, ShieldCheck, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PMS = ["Guesty (PMS)", "Resales Online (MLS)", "Inmobalia (CRM)", "Airbnb iCal", "Booking.com iCal", "VRBO iCal", "Google Calendar iCal", "Manual calendar"];

export default function ForOwners() {
  return (
    <div>
      <section className="container py-16 text-center">
        <span className="rounded-full bg-gold/25 px-3 py-1 text-sm font-semibold text-gold-foreground">For property managers, agencies & owners</span>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-extrabold md:text-5xl">Turn other agents into your sales team. No platform fee, you only pay commission on bookings.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Import your listings from Guesty, Resales Online or Inmobalia in one click, or add them by hand. Calendars sync from your PMS or your Airbnb / Booking.com link, so partner agencies only see dates that are really free.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth?mode=signup"><Button size="lg" variant="gold">Create free account</Button></Link>
          <Link to="/search"><Button size="lg" variant="outline">See listings</Button></Link>
        </div>
      </section>
      <section className="container grid gap-5 pb-16 md:grid-cols-4">
        {[
          { i: Upload, t: "Import in one click", s: "Photos, description, location and prices come straight from your PMS or MLS." },
          { i: CalendarClock, t: "Connect your calendar", s: "Paste an iCal URL or link your PMS. We re-sync every 15 minutes." },
          { i: Handshake, t: "Your price, your commission", s: "Set a monthly price instead of PMS nightly rates, and the % you pay agents who bring a booking." },
          { i: ShieldCheck, t: "You stay in control", s: "Show to everyone or only to verified network members." },
        ].map(({ i: I, t, s }) => (
          <Card key={t} className="p-6"><I className="mb-3 h-6 w-6 text-primary" /><div className="font-semibold">{t}</div><p className="mt-1 text-sm text-muted-foreground">{s}</p></Card>
        ))}
      </section>
      <section className="border-y bg-secondary/50 py-14">
        <div className="container grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Works with the tools you already use</h2>
            <p className="mt-2 text-muted-foreground">Any channel that exports an iCal link works out of the box. PMS integrations pull availability and listing data directly.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PMS.map((x) => <div key={x} className="flex items-center gap-2 rounded-md border bg-card px-4 py-3 text-sm"><Check className="h-4 w-4 text-primary" />{x}</div>)}
          </div>
        </div>
      </section>
      <section className="container py-16">
        <h2 className="mb-6 text-2xl font-bold">FAQ</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["What does it cost?", "Nothing in phase 1. No subscription and no platform fee. You only pay the agent commission you set, and only when an agent brings a booking."],
            ["How do agents earn?", "Each listing shows the commission % you offer. The agent sends a booking request for their client, you confirm and contract direct, then pay the agent their commission."],
            ["I don't use a PMS. Can I join?", "Yes. Add your property by hand and paste the iCal link from Airbnb or Booking.com, or import from Resales Online / Inmobalia."],
            ["Do I have to use my PMS nightly rates?", "No. Per listing you choose: your own monthly price, or the rate mirrored from your PMS."],
            ["Who can see my property?", "Public listings are visible to everyone. 'Network only' listings are visible to signed-in members."],
            ["Do I have to stop using Airbnb?", "No. Keep your channels. DirectStay reads your calendar so double bookings are avoided."],
            ["Who handles the contract?", "The listing agency or owner contracts directly with the tenant. DirectStay only connects the parties."],
          ].map(([q, a]) => <Card key={q} className="p-5"><div className="font-semibold">{q}</div><p className="mt-1 text-sm text-muted-foreground">{a}</p></Card>)}
        </div>
      </section>
    </div>
  );
}
