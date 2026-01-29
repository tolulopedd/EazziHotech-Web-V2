import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Save, Shield } from "lucide-react";

import { apiFetch } from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TenantSettings = {
  minDepositPercent: number;
  maxProperties: number;
  maxUnits: number;
  maxUsers: number;
  createdAt?: string;
  updatedAt?: string;
};

export default function Settings() {
  const userRole = (localStorage.getItem("userRole") || "STAFF").toUpperCase();
  const isAdmin = userRole === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [savingTenant, setSavingTenant] = useState(false);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);

  const [tenantForm, setTenantForm] = useState({
    name: "",
    slug: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function boot() {
    try {
      setLoading(true);

      // ✅ Only fetch tenant + settings
      const tData = await apiFetch("/api/tenant");

      const tObj: Tenant = tData.tenant || tData;
      const sObj: TenantSettings | null = tData.settings || null;

      setTenant(tObj);
      setSettings(sObj);

      setTenantForm({
        name: tObj.name || "",
        slug: tObj.slug || "",
        email: tObj.email || "",
        phone: tObj.phone || "",
        address: tObj.address || "",
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load workspace settings");
    } finally {
      setLoading(false);
    }
  }

  const tenantChanged = useMemo(() => {
    if (!tenant) return false;
    return (
      tenantForm.name !== (tenant.name || "") ||
      tenantForm.slug !== (tenant.slug || "") ||
      tenantForm.email !== (tenant.email || "") ||
      tenantForm.phone !== (tenant.phone || "") ||
      tenantForm.address !== (tenant.address || "")
    );
  }, [tenant, tenantForm]);

  async function saveTenant() {
    if (!isAdmin) return;

    if (!tenantForm.name.trim()) return toast.error("Workspace name is required");
    if (!tenantForm.slug.trim()) return toast.error("Workspace slug is required");

    try {
      setSavingTenant(true);

      const data = await apiFetch("/api/tenant", {
        method: "PATCH",
        body: JSON.stringify({
          name: tenantForm.name.trim(),
          slug: tenantForm.slug.trim(),
          email: tenantForm.email.trim() || null,
          phone: tenantForm.phone.trim() || null,
          address: tenantForm.address.trim() || null,
        }),
      });

      const updatedTenant: Tenant = data.tenant || data;
      setTenant(updatedTenant);

      // keep header/sidebar labels in sync
      localStorage.setItem("tenantName", updatedTenant.name);
      localStorage.setItem("tenantSlug", updatedTenant.slug);

      toast.success("Workspace updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update workspace");
    } finally {
      setSavingTenant(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Workspace information and tenant subscription limits.
          </p>
        </div>

        <Button variant="outline" onClick={boot}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Workspace */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            Workspace
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {!tenant ? (
            <div className="text-sm text-muted-foreground">Workspace details not available.</div>
          ) : (
            <>
              {!isAdmin ? (
                <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                  View only. Only Admin can edit workspace basic info.
                </div>
              ) : null}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input
                    value={tenantForm.name}
                    disabled={!isAdmin}
                    onChange={(e) => setTenantForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Workspace Slug</Label>
                  <Input
                    value={tenantForm.slug}
                    disabled={!isAdmin}
                    onChange={(e) => setTenantForm((p) => ({ ...p, slug: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    value={tenantForm.email}
                    disabled={!isAdmin}
                    onChange={(e) => setTenantForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={tenantForm.phone}
                    disabled={!isAdmin}
                    onChange={(e) => setTenantForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={tenantForm.address}
                  disabled={!isAdmin}
                  onChange={(e) => setTenantForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>

              {isAdmin ? (
                <div className="flex justify-end">
                  <Button onClick={saveTenant} disabled={savingTenant || !tenantChanged}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingTenant ? "Saving..." : "Save Workspace"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tenant Settings (View Only) */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Tenant Settings (View Only)</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-sm">
          {!settings ? (
            <div className="text-muted-foreground">
              Tenant settings not available.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Min Deposit:</span>{" "}
                <span className="font-semibold">{settings.minDepositPercent}%</span>
              </div>

              <div>
                <span className="text-muted-foreground">Max Properties:</span>{" "}
                <span className="font-semibold">{settings.maxProperties}</span>
              </div>

              <div>
                <span className="text-muted-foreground">Max Units:</span>{" "}
                <span className="font-semibold">{settings.maxUnits}</span>
              </div>

              <div>
                <span className="text-muted-foreground">Max Users:</span>{" "}
                <span className="font-semibold">{settings.maxUsers}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            These settings are controlled from the EazziHotech (view-only to tenants).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
