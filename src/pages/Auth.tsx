import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { isDemo } from "@/lib/supabase";
import type { AccountType } from "@/lib/types";

export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "signin";
  const { profile, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: isDemo && mode === "signin" ? "demo@directstay.app" : "", password: isDemo && mode === "signin" ? "demo1234" : "", full_name: "", org_type: "agency" as AccountType, org_name: "", city: "", country: "Spain", phone: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  if (profile) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await signIn(f.email, f.password);
      else await signUp({ ...f, role: f.org_type === "agency" ? "agent" : "owner", referred_by: params.get("ref") });
      nav("/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="container flex justify-center py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Sign in" : "Join the exchange"}</CardTitle>
          <CardDescription>{mode === "signin" ? "Welcome back." : params.get("ref") ? "You were invited by a partner agency. Free for property managers and owners." : "Free for property managers, agencies and owners."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(["agency", "private"] as AccountType[]).map((t) => (
                    <button type="button" key={t} onClick={() => setF({ ...f, org_type: t })}
                      className={`rounded-md border px-3 py-3 text-sm ${f.org_type === t ? "border-primary bg-primary/10 text-primary" : ""}`}>
                      {t === "agency" ? "I'm an agency" : "I'm a private owner"}
                    </button>
                  ))}
                </div>
                <div className="space-y-1"><Label>Your name</Label><Input required value={f.full_name} onChange={set("full_name")} /></div>
                {f.org_type === "agency" && <div className="space-y-1"><Label>Agency name</Label><Input required value={f.org_name} onChange={set("org_name")} /></div>}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>City</Label><Input required value={f.city} onChange={set("city")} /></div>
                  <div className="space-y-1"><Label>Country</Label>
                    <Select value={f.country} onChange={set("country")}>{["Spain", "Austria", "Germany", "Switzerland", "Portugal", "Italy", "France", "Other"].map((c) => <option key={c}>{c}</option>)}</Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Phone</Label><Input value={f.phone} onChange={set("phone")} /></div>
              </>
            )}
            <div className="space-y-1"><Label>Email</Label><Input type="email" required value={f.email} onChange={set("email")} /></div>
            <div className="space-y-1"><Label>Password</Label><Input type="password" required minLength={6} value={f.password} onChange={set("password")} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here? " : "Already a member? "}
            <button className="text-primary" onClick={() => setParams(mode === "signin" ? { mode: "signup", ...(params.get("ref") ? { ref: params.get("ref")! } : {}) } : {})}>{mode === "signin" ? "Create an account" : "Sign in"}</button>
          </p>
          {isDemo && mode === "signin" && <p className="mt-2 text-center text-xs text-muted-foreground">Demo login is pre-filled.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
