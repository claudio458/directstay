import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import { AuthProvider } from "@/hooks/useAuth";
import Home from "@/pages/Home";
import SearchPage from "@/pages/Search";
import Regions from "@/pages/Regions";
import PropertyPage from "@/pages/Property";
import ForOwners from "@/pages/ForOwners";
import AuthPage from "@/pages/Auth";
import { AgencyPage, Network } from "@/pages/Network";
import { Legal, NotFound } from "@/pages/Legal";
import Dashboard from "@/pages/dashboard/Dashboard";
import ListingEditor from "@/pages/dashboard/ListingEditor";
import ImportListings from "@/pages/dashboard/ImportListings";

// Static previews without SPA rewrites build with VITE_HASH_ROUTER=1 (npm run build:preview).
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter;

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } });

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Router>
          <ScrollTop />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/areas" element={<Regions />} />
              <Route path="/regions" element={<Regions />} />
              <Route path="/area/:slug" element={<SearchPage />} />
              <Route path="/region/:slug" element={<SearchPage />} />
              <Route path="/property/:slug" element={<PropertyPage />} />
              <Route path="/network" element={<Network />} />
              <Route path="/agency/:id" element={<AgencyPage />} />
              <Route path="/list-your-property" element={<ForOwners />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/listings/:id" element={<ListingEditor />} />
              <Route path="/dashboard/import" element={<ImportListings />} />
              <Route path="/legal/:page" element={<Legal />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
        <Toaster theme="dark" position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
