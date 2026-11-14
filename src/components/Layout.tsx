import { Link, NavLink, Outlet } from "react-router-dom";
import { Home, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isDemo } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/search", label: "Search" },
  { to: "/areas", label: "Areas" },
  { to: "/network", label: "Agent network" },
  { to: "/list-your-property", label: "For property managers" },
];

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-bold text-lg">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold text-gold-foreground"><Home className="h-4 w-4" /></span>
      DirectStay
    </Link>
  );
}

export default function Layout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      {isDemo && (
        <div className="bg-secondary px-4 py-1.5 text-center text-xs text-muted-foreground">
          Demo mode: sample data stored in your browser. Connect Supabase to go live (see README).
        </div>
      )}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn("text-sm text-muted-foreground hover:text-foreground", isActive && "text-foreground")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {profile ? (
              <>
                <Link to="/dashboard"><Button variant="secondary" size="sm">Dashboard</Button></Link>
                <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut /></Button>
              </>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/auth?mode=signup"><Button size="sm" variant="gold">Join free</Button></Link>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
        </div>
        {open && (
          <div className="border-t md:hidden">
            <div className="container flex flex-col gap-1 py-3" onClick={() => setOpen(false)}>
              {nav.map((n) => <Link key={n.to} to={n.to} className="rounded px-2 py-2 hover:bg-accent">{n.label}</Link>)}
              {profile ? (
                <>
                  <Link to="/dashboard" className="rounded px-2 py-2 hover:bg-accent">Dashboard</Link>
                  <button onClick={signOut} className="rounded px-2 py-2 text-left hover:bg-accent">Sign out</button>
                </>
              ) : (
                <Link to="/auth" className="rounded px-2 py-2 hover:bg-accent">Sign in / Join</Link>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t py-10 text-sm text-muted-foreground">
        <div className="container grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2 space-y-3">
            <Logo />
            <p className="max-w-sm">The B2B exchange for property managers on the Costa del Sol. The homes you know from Airbnb and Booking.com, bookable direct: no platform fee, agents earn commission.</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-foreground">Platform</span>
            <Link to="/search">Find a property</Link>
            <Link to="/list-your-property">List a property</Link>
            <Link to="/network">Agent network</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-foreground">Legal</span>
            <Link to="/legal/imprint">Imprint</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
