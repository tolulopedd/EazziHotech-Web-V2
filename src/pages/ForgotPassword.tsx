import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicFetch, apiFetch } from "@/lib/api";

type Tenant = { id: string; name: string; slug: string };

export default function ForgotPassword() {
  const nav = useNavigate();
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (e.target instanceof Node && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    const q = tenantQuery.trim();
    if (q.length < 2) {
      setTenants([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await publicFetch(`/api/public/tenants?query=${encodeURIComponent(q)}`);
        setTenants(data.tenants || []);
      } catch (err: any) {
        toast.error(err?.message || "Failed to search workspaces");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [tenantQuery]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) return toast.error("Email is required");
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          tenantSlug: selectedTenant?.slug,
          tenantId: selectedTenant?.id,
          email,
        }),
      });
      toast.success("If the email exists, a reset link was sent");
      nav("/login");
    } catch (err: any) {
      toast.error(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center space-y-2">
          <div className="text-3xl font-bold tracking-tight text-indigo-700">EazziHotech</div>
          <div className="text-sm text-muted-foreground">Reset your account password</div>
        </div>

        <Card className="rounded-2xl border-indigo-300 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Reset password</CardTitle>
            <p className="text-xs text-slate-400 text-muted-foreground text-center">
              Enter your workspace (optional) and email to receive a reset link.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2 relative" ref={menuRef}>
                <Label>Workspace (optional)</Label>
                <Input
                  className="border border-indigo-200 focus:border-indigo-500 focus:ring-indigo-600"
                  placeholder="Type workspace (min 2 chars)"
                  value={tenantQuery}
                  onChange={(e) => { setTenantQuery(e.target.value); setMenuOpen(true); }}
                  onFocus={() => setMenuOpen(true)}
                  autoComplete="off"
                />
                <div className="absolute left-0 right-0 mt-1 z-50">
                  <div className={`w-full bg-white border rounded-md shadow-md max-h-56 overflow-auto transition-opacity ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                    {tenantQuery.trim().length < 2 ? (
                      <div className="p-3 text-sm text-muted-foreground">Type at least 2 characters</div>
                    ) : tenants.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">No workspaces found</div>
                    ) : tenants.map((t) => (
                      <button key={t.id} type="button" className="w-full text-left p-3 hover:bg-slate-50"
                        onClick={() => { setSelectedTenant(t); setTenantQuery(t.name); setMenuOpen(false); }}>
                        <div className="flex flex-col">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground">@{t.slug}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>

              <Button className="w-full bg-indigo-200 hover:bg-indigo-700 text-white" disabled={loading} type="submit">
                {loading ? "Sending..." : "Send reset link"}
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