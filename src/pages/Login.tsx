import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { apiFetch, publicFetch, setAuthSession } from "@/lib/api";

type Tenant = { id: string; name: string; slug: string };

function readPositiveIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intVal = Math.floor(parsed);
  return intVal > 0 ? intVal : fallback;
}

const MAX_FAILED_ATTEMPTS = readPositiveIntEnv(import.meta.env.VITE_LOGIN_MAX_FAILED_ATTEMPTS, 5);
const LOCKOUT_SECONDS = readPositiveIntEnv(import.meta.env.VITE_LOGIN_LOCKOUT_SECONDS, 30);

export default function Login() {
  const nav = useNavigate();

  // Workspace selection
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Combobox-style workspace selector
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Login creds
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntilMs, setLockUntilMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const lockRemainingSec = lockUntilMs ? Math.max(0, Math.ceil((lockUntilMs - nowMs) / 1000)) : 0;
  const isTemporarilyLocked = lockRemainingSec > 0;

  // Close dropdown on outside click
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

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (lockUntilMs && lockRemainingSec === 0) {
      setLockUntilMs(null);
    }
  }, [lockRemainingSec, lockUntilMs]);

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
        const data = await publicFetch(
          `/api/public/tenants?query=${encodeURIComponent(q)}`
        );
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

    // Persist selection so apiFetch can automatically attach x-tenant-id
    localStorage.setItem("tenantId", t.id);
    localStorage.setItem("tenantSlug", t.slug);
    localStorage.setItem("tenantName", t.name);

    toast.success(`Workspace selected: ${t.name}`);
    setMenuOpen(false);
    setTenants([]);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isTemporarilyLocked) {
      toast.error(`Too many failed attempts. Try again in ${lockRemainingSec}s.`);
      return;
    }

    if (!selectedTenant?.id) {
      toast.error("Please select your workspace first.");
      return;
    }

    setLoading(true);

    try {
      // apiFetch automatically attaches:
      // - x-tenant-id from localStorage (set in pickTenant)
      // - Authorization if token exists (not required for login)
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      console.log("Login response:", data);

      // New response shape (with backward-compat fallback)
      const accessToken = data?.accessToken ?? data?.tokens?.accessToken;
      const refreshToken = data?.refreshToken ?? data?.tokens?.refreshToken;
      const tenantId = data?.tenantId ?? data?.user?.tenantId ?? selectedTenant.id;

      if (!accessToken) throw new Error("Login response missing accessToken");
      if (!tenantId) throw new Error("Login response missing tenantId");

	      setAuthSession({ tenantId, accessToken, refreshToken });
	      setFailedAttempts(0);
	      setLockUntilMs(null);

      // Store user info for topbar (support both shapes)
      const userName = data?.user?.fullName || data?.user?.name || data?.user?.email || email;
      const userRole = (data?.role || data?.user?.role || "staff").toString().toLowerCase();

      localStorage.setItem("userName", userName);
      localStorage.setItem("userRole", userRole);
      localStorage.setItem("userId", data?.user?.id || "");
      localStorage.setItem("userEmail", data?.user?.email || email);
      localStorage.setItem("isSuperAdmin", data?.isSuperAdmin ? "true" : "false");
      if (data?.subscription) {
        localStorage.setItem("subscriptionStatus", data.subscription.status || "ACTIVE");
        localStorage.setItem(
          "subscriptionCurrentPeriodEndAt",
          data.subscription.currentPeriodEndAt || ""
        );
        localStorage.setItem(
          "subscriptionDaysToExpiry",
          data.subscription.daysToExpiry != null ? String(data.subscription.daysToExpiry) : ""
        );
        if (data.subscription.expiringSoon) {
          const d = Number(data.subscription.daysToExpiry ?? 0);
          toast(`Subscription expires in ${d} day${d === 1 ? "" : "s"}.`);
        }
      } else {
        localStorage.removeItem("subscriptionStatus");
        localStorage.removeItem("subscriptionCurrentPeriodEndAt");
        localStorage.removeItem("subscriptionDaysToExpiry");
      }

      toast.success("Logged in");
      nav("/app/dashboard");
    } catch (err: any) {
      const code = err?.code || err?.data?.code || err?.data?.error?.code;
      const details = err?.data?.error?.details || err?.data?.details;
      const msg =
        err instanceof Error ? err.message : err?.message || "Login failed";

      if (code === "TENANT_SUSPENDED") {
        const until = details?.currentPeriodEndAt
          ? new Date(details.currentPeriodEndAt).toLocaleDateString()
          : null;
        toast.error(
          until
            ? `Subscription inactive since ${until}. Renew subscription to continue.`
            : "Subscription suspended. Renew subscription to continue."
        );
        return;
      }
      if (code === "SUPERADMIN_REQUIRED") {
        toast.error("Only platform super admin can change subscription access.");
        return;
      }

      const invalidCredentials =
        code === "INVALID_CREDENTIALS" || /invalid email or password/i.test(msg);
      if (invalidCredentials) {
        const nextFailures = failedAttempts + 1;
        if (nextFailures >= MAX_FAILED_ATTEMPTS) {
          setFailedAttempts(0);
          setLockUntilMs(Date.now() + LOCKOUT_SECONDS * 1000);
          toast.error(`Too many failed attempts. Login locked for ${LOCKOUT_SECONDS} seconds.`);
          return;
        }
        setFailedAttempts(nextFailures);
        toast.error(
          `Invalid email or password. ${MAX_FAILED_ATTEMPTS - nextFailures} attempt(s) remaining before temporary lock.`
        );
        return;
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center space-y-2">
          <div className="text-3xl font-bold tracking-tight text-indigo-700">
            EazziHotech
          </div>
          <div className="text-sm text-muted-foreground">
            Sign in to your hotel / shortlet workspace
          </div>
        </div>

        <Card className="rounded-2xl border-indigo-300 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Sign in</CardTitle>
            <p className="text-xs text-slate-400 text-muted-foreground text-center">
              Select your workspace, then sign in.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
              {/* Workspace selector */}
              <div className="space-y-2 relative" ref={menuRef}>
                <Label>Workspace</Label>

                <Input
                  className={`border border-indigo-200 focus:border-indigo-500 focus:ring-indigo-600 ${
                    selectedTenant && tenantQuery === selectedTenant.name
                      ? "text-indigo-500"
                      : "text-slate-400"
                  }`}
                  placeholder="Type your workspace name (min 2 chars)"
                  value={tenantQuery}
                  onChange={(e) => {
                    setTenantQuery(e.target.value);
                    setMenuOpen(true);
                  }}
                  onFocus={() => setMenuOpen(true)}
                  autoComplete="off"
                  disabled={isTemporarilyLocked}
                />

                <div className="absolute left-0 right-0 mt-1 z-50">
                  <div
                    className={`w-full bg-white border rounded-md shadow-md max-h-56 overflow-auto transition-opacity ${
                      menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                  >
                    {loadingTenants ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        Searching...
                      </div>
                    ) : tenantQuery.trim().length < 2 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        Type at least 2 characters
                      </div>
                    ) : tenants.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        No workspaces found
                      </div>
                    ) : (
                      tenants.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="w-full text-left p-3 hover:bg-slate-50"
                          onClick={() => pickTenant(t)}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground">
                              @{t.slug}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Selected tenant label (optional display) */}
                {selectedTenant && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Selected: {tenantLabel}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  className="border border-indigo-300 focus:border-indigo-500 focus:ring-indigo-600"
                  id="email"
                  name="username"
                  type="email"
                  placeholder="name@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={isTemporarilyLocked}
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

                <div className="relative">
                  <Input
                    className="border border-indigo-300 focus:border-indigo-500 focus:ring-indigo-600 pr-20"
                    id="password"
                    name="current-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isTemporarilyLocked}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:underline"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {isTemporarilyLocked ? (
                <div className="text-xs text-red-600 text-center">
                  Too many failed attempts. Try again in {lockRemainingSec}s.
                </div>
              ) : null}

              <Button
                className="w-full bg-indigo-700 hover:bg-indigo-800 text-white"
                disabled={loading || isTemporarilyLocked}
                type="submit"
              >
                {loading ? "Signing in..." : isTemporarilyLocked ? `Try again in ${lockRemainingSec}s` : "Sign in"}
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
