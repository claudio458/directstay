import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type SignUpInput } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Organization, Profile } from "@/lib/types";

interface AuthCtx {
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(i: SignUpInput): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const p = await api.currentProfile().catch(() => null);
    setProfile(p);
    setOrganization(p ? await api.getOrganization(p.organization_id) : null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const sub = supabase?.auth.onAuthStateChange(() => { refresh(); });
    return () => sub?.data.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    profile, organization, loading, refresh,
    async signIn(e, p) { await api.signIn(e, p); await refresh(); },
    async signUp(i) { await api.signUp(i); await refresh(); },
    async signOut() { await api.signOut(); await refresh(); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
