import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { apiFetch, publicFetch, setAuthSession } from "@/lib/api";

type Tenant = { id: string; name: string; slug: string };

export default function Login() {
  const nav = useNavigate();

  // Workspace selection
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // --- Combobox-style workspace selector (paste in place of the existing Input+DropdownMenu) ---
const menuRef = useRef<HTMLDivElement | null>(null);
const [menuOpen, setMenuOpen] = useState(false);

useEffect(() => {
  function onDocClick(e: MouseEvent) {
    if (!menuRef.current) return;
    if (e.target instanceof Node && !menuRef.current.contains(e.target)) {
      setMenuOpen(false);
    }
  }
  document.addEventListener("click", onDocClick);
  return () => document.removeEventListener("click", onDocClick);
}, []);

  // Login creds
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);

  // Load previously selected tenant (if any)
useEffect(() => {
  const tenantId = localStorage.getItem("tenantId");
  const tenantSlug = localStorage.getItem("tenantSlug");
  const tenantName = localStorage.getItem("tenantName");
  if (tenantId && tenantSlug && tenantName) {
    setSelectedTenant({ id: tenantId, slug: tenantSlug, name: tenantName });
    setTenantQuery(tenantName);
  }
}, []);

  // Search tenants (debounced)
  useEffect(() => {
    const q = tenantQuery.trim();
    if (q.length < 2) {
      setTenants([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setLoadingTenants(true);
        const data = await publicFetch(`/api/public/tenants?query=${encodeURIComponent(q)}`);
        setTenants(data.tenants || []);
      } catch (err: any) {
        toast.error(err?.message || "Failed to search workspaces");
      } finally {
        setLoadingTenants(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [tenantQuery]);

  const tenantLabel = useMemo(() => {
    if (!selectedTenant) return "Select workspace";
    return `${selectedTenant.name} (@${selectedTenant.slug})`;
  }, [selectedTenant]);

 function pickTenant(t: Tenant) {
  setSelectedTenant(t);
  setTenantQuery(t.name);
  localStorage.setItem("tenantId", t.id);
  localStorage.setItem("tenantSlug", t.slug);
  localStorage.setItem("tenantName", t.name);
  toast.success(`Workspace selected: ${t.name}`);
  setMenuOpen(false);
  setTenants([]);
}
// In src/pages/Login.tsx, update the onSubmit function:

async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();

  if (!selectedTenant?.slug) {
    toast.error("Please select your workspace first.");
    return;
  }

  setLoading(true);

  try {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        tenantSlug: selectedTenant.slug,
        email,
        password,
      }),
    });

    // Log the response to see the structure
    console.log("Login response:", data);

    // Extract tenant ID - it could be from user.tenantId or directly from the response
    const tenantId = data.user?.tenantId || data.tenantId || selectedTenant.id;

    setAuthSession({
      tenantId: tenantId,
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
    });

    // Store user info for the topbar
    localStorage.setItem("userName", data.user?.name || data.user?.email || "User");
    localStorage.setItem("userRole", data.user?.role || "staff");
    localStorage.setItem("userId", data.user?.id || "");

    toast.success("Logged in");
    nav("/app/dashboard");
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message || "Login failed";
    toast.error(msg);
  } finally {
    setLoading(false);
  }
}

  return (
<div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
  <div className="w-full max-w-md">

        <div className="mb-6 text-center space-y-2">
          <div className="text-3xl font-bold tracking-tight text-indigo-700">EazziHotech</div>
          <div className="text-sm text-muted-foreground">
            Sign in to your hotel / shortlet workspace
          </div>
        </div>

        <Card className="rounded-2xl border-indigo-300 bg-white shadow-sm">

          <CardHeader className="space-y-1 ">
            <CardTitle className="text-xl text-center">Sign in</CardTitle>
            <p className="text-xs text-slate-400 text-muted-foreground text-center">
              Select your workspace, then sign in.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Workspace selector */}
              <div className="space-y-2 relative" ref={menuRef}>
  <Label>Workspace</Label>

<Input
  className={`border border-indigo-200 focus:border-indigo-500 focus:ring-indigo-600 ${
    selectedTenant && tenantQuery === selectedTenant.name ? "text-indigo-500" : "text-slate-400"
  }`}
  placeholder="Type your workspace name (min 2 chars)"
  value={tenantQuery}
  onChange={(e) => {
    setTenantQuery(e.target.value);
    setMenuOpen(true);
  }}
  onFocus={() => setMenuOpen(true)}
  autoComplete="off"
/>

  <div className="absolute left-0 right-0 mt-1 z-50">
    <div
      className={`w-full bg-white border rounded-md shadow-md max-h-56 overflow-auto transition-opacity ${
        menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {tenantQuery.trim().length < 2 ? (
        <div className="p-3 text-sm text-muted-foreground">Type at least 2 characters</div>
      ) : tenants.length === 0 ? (
        <div className="p-3 text-sm text-muted-foreground">No workspaces found</div>
      ) : (
        tenants.map((t) => (
          <button
            key={t.id}
            type="button"
            className="w-full text-left p-3 hover:bg-slate-50"
            onClick={() => {
              pickTenant(t);
              setMenuOpen(false);
            }}
          >
            <div className="flex flex-col">
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">@{t.slug}</span>
            </div>
          </button>
        ))
      )}
    </div>
  </div>
</div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input className="border border-indigo-300 focus:border-indigo-500 focus:ring-indigo-600"
                  id="email"
                  placeholder="admin@hotel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => nav("/forgot-password")}
                  >
                    Forgot password?
                  </button>
                </div>

                <Input className="border border-indigo-300 focus:border-indigo-500 focus:ring-indigo-600"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <Button className="w-full bg-indigo-200 hover:bg-indigo-700 text-white" disabled={loading} type="submit">
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                By continuing, you agree to your organization’s access policy.
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} EazziHotech. All rights reserved.
        </div>
      </div>
    </div>
  );
}
