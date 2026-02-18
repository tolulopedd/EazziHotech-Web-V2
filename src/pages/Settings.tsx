import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import { Building2, Gauge, RefreshCw, Save, Shield, SlidersHorizontal, UserPlus } from "lucide-react";

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
  subscriptionStatus?: "ACTIVE" | "GRACE" | "SUSPENDED";
  currentPeriodEndAt?: string | null;
  graceEndsAt?: string | null;
  daysToExpiry?: number | null;
  expiringSoon?: boolean;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  settings?: TenantSettings | null;
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

type Usage = {
  propertiesCount: number | null;
  unitsCount: number | null;
  usersCount: number | null;
  canViewUnits: boolean;
  canViewUsers: boolean;
};

type CreateTenantForm = {
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string;
  subscriptionStatus: "ACTIVE" | "GRACE" | "SUSPENDED";
  currentPeriodEndDate: string;
  graceEndDate: string;
  minDepositPercent: string;
  maxProperties: string;
  maxUnits: string;
  maxUsers: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
  adminPhone: string;
};

const numberFmt = new Intl.NumberFormat("en-US");

function formatDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function toDateInput(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function toPolicyForm(settings?: TenantSettings | null) {
  return {
    minDepositPercent: String(settings?.minDepositPercent ?? 100),
    maxProperties: String(settings?.maxProperties ?? 20),
    maxUnits: String(settings?.maxUnits ?? 500),
    maxUsers: String(settings?.maxUsers ?? 100),
  };
}

function progressColor(pct: number) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

function ProgressRow({
  label,
  current,
  limit,
  hidden,
}: {
  label: string;
  current: number | null;
  limit: number;
  hidden?: boolean;
}) {
  if (hidden) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">Restricted</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100" />
      </div>
    );
  }

  const currentValue = Number(current ?? 0);
  const pct = clampPct((currentValue / Math.max(limit, 1)) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-slate-900">
          {numberFmt.format(currentValue)} / {numberFmt.format(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}% of plan limit used</p>
    </div>
  );
}

export default function Settings() {
  const userRole = (localStorage.getItem("userRole") || "STAFF").toUpperCase();
  const isAdmin = userRole === "ADMIN";
  const canViewUsersUnits = userRole === "ADMIN" || userRole === "MANAGER";
  const [isSuperAdmin, setIsSuperAdmin] = useState(localStorage.getItem("isSuperAdmin") === "true");

  const [loading, setLoading] = useState(true);
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [savingPolicyLimits, setSavingPolicyLimits] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [refreshingUsage, setRefreshingUsage] = useState(false);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [usage, setUsage] = useState<Usage>({
    propertiesCount: null,
    unitsCount: null,
    usersCount: null,
    canViewUnits: canViewUsersUnits,
    canViewUsers: canViewUsersUnits,
  });

  const [tenantForm, setTenantForm] = useState({
    name: "",
    slug: "",
    email: "",
    phone: "",
    address: "",
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    subscriptionStatus: "ACTIVE" as "ACTIVE" | "GRACE" | "SUSPENDED",
    currentPeriodEndDate: "",
    graceEndDate: "",
  });
  const [policyForm, setPolicyForm] = useState(toPolicyForm(null));
  const [platformTenants, setPlatformTenants] = useState<Tenant[]>([]);
  const [selectedPlatformTenantId, setSelectedPlatformTenantId] = useState("");
  const [createTenantForm, setCreateTenantForm] = useState<CreateTenantForm>({
    name: "",
    slug: "",
    email: "",
    phone: "",
    address: "",
    subscriptionStatus: "ACTIVE",
    currentPeriodEndDate: "",
    graceEndDate: "",
    minDepositPercent: "100",
    maxProperties: "20",
    maxUnits: "500",
    maxUsers: "100",
    adminEmail: "",
    adminPassword: "",
    adminFullName: "",
    adminPhone: "",
  });

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTenantFieldChange(field: keyof typeof tenantForm) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setTenantForm((p) => ({ ...p, [field]: e.target.value }));
    };
  }

  async function loadUsageData(showLoader = false) {
    try {
      if (showLoader) setRefreshingUsage(true);

      const propertiesReq = apiFetch("/api/properties");
      const unitsReq = canViewUsersUnits ? apiFetch("/api/units") : Promise.resolve(null);
      const usersReq = canViewUsersUnits ? apiFetch("/api/users?page=1&pageSize=1") : Promise.resolve(null);

      const [propertiesData, unitsData, usersData] = await Promise.all([propertiesReq, unitsReq, usersReq]);

      const propertiesCount = Array.isArray(propertiesData?.properties) ? propertiesData.properties.length : 0;
      const unitsCount = canViewUsersUnits
        ? Array.isArray((unitsData as any)?.units)
          ? (unitsData as any).units.length
          : 0
        : null;
      const usersCount = canViewUsersUnits
        ? typeof (usersData as any)?.total === "number"
          ? (usersData as any).total
          : Array.isArray((usersData as any)?.users)
          ? (usersData as any).users.length
          : 0
        : null;

      setUsage({
        propertiesCount,
        unitsCount,
        usersCount,
        canViewUnits: canViewUsersUnits,
        canViewUsers: canViewUsersUnits,
      });
    } catch {
      setUsage((prev) => ({
        ...prev,
        propertiesCount: prev.propertiesCount ?? 0,
      }));
    } finally {
      if (showLoader) setRefreshingUsage(false);
    }
  }

  async function boot() {
    try {
      setLoading(true);
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
      setSubscriptionForm({
        subscriptionStatus: tObj.subscriptionStatus || "ACTIVE",
        currentPeriodEndDate: toDateInput(tObj.currentPeriodEndAt),
        graceEndDate: toDateInput(tObj.graceEndsAt),
      });
      setPolicyForm(toPolicyForm(sObj));

      await loadUsageData(false);
      await loadPlatformTenants(tObj.id);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load workspace settings");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlatformTenants(preferredTenantId?: string) {
    try {
      const data = await apiFetch("/api/platform/tenants?page=1&pageSize=200");
      const tenants: Tenant[] = Array.isArray(data?.tenants) ? data.tenants : [];
      setPlatformTenants(tenants);
      setIsSuperAdmin(true);
      localStorage.setItem("isSuperAdmin", "true");

      const preferred =
        tenants.find((t) => t.id === preferredTenantId) ||
        tenants.find((t) => t.id === selectedPlatformTenantId) ||
        tenants[0];

      if (preferred) {
        setSelectedPlatformTenantId(preferred.id);
        setSubscriptionForm({
          subscriptionStatus: preferred.subscriptionStatus || "ACTIVE",
          currentPeriodEndDate: toDateInput(preferred.currentPeriodEndAt),
          graceEndDate: toDateInput(preferred.graceEndsAt),
        });
        setPolicyForm(toPolicyForm(preferred.settings));
      } else {
        setSelectedPlatformTenantId("");
      }
    } catch {
      setIsSuperAdmin(false);
      localStorage.setItem("isSuperAdmin", "false");
      setPlatformTenants([]);
      setSelectedPlatformTenantId("");
      setPolicyForm(toPolicyForm(settings));
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

  const subscriptionChanged = useMemo(() => {
    const baseTenant = isSuperAdmin
      ? platformTenants.find((t) => t.id === selectedPlatformTenantId) || null
      : tenant;
    if (!baseTenant) return false;
    return (
      (subscriptionForm.subscriptionStatus || "ACTIVE") !== (baseTenant.subscriptionStatus || "ACTIVE") ||
      subscriptionForm.currentPeriodEndDate !== toDateInput(baseTenant.currentPeriodEndAt) ||
      subscriptionForm.graceEndDate !== toDateInput(baseTenant.graceEndsAt)
    );
  }, [isSuperAdmin, platformTenants, selectedPlatformTenantId, tenant, subscriptionForm]);

  const selectedPlatformTenant = useMemo(
    () => platformTenants.find((t) => t.id === selectedPlatformTenantId) || null,
    [platformTenants, selectedPlatformTenantId]
  );

  const effectiveSettings = useMemo(() => {
    if (isSuperAdmin) return selectedPlatformTenant?.settings || null;
    return settings;
  }, [isSuperAdmin, selectedPlatformTenant, settings]);

  const policyChanged = useMemo(() => {
    const base = effectiveSettings;
    if (!base) return false;
    return (
      Number(policyForm.minDepositPercent) !== Number(base.minDepositPercent) ||
      Number(policyForm.maxProperties) !== Number(base.maxProperties) ||
      Number(policyForm.maxUnits) !== Number(base.maxUnits) ||
      Number(policyForm.maxUsers) !== Number(base.maxUsers)
    );
  }, [effectiveSettings, policyForm]);

  async function saveTenant() {
    if (!isAdmin) return;
    if (!tenantForm.name.trim()) return toast.error("Workspace name is required");
    if (!tenantForm.slug.trim()) return toast.error("Workspace slug is required");
    if (!isValidSlug(tenantForm.slug.trim())) {
      return toast.error("Workspace slug must be lowercase letters, numbers, and hyphens only");
    }
    if (tenantForm.email.trim() && !isValidEmail(tenantForm.email.trim())) {
      return toast.error("Contact email is not valid");
    }

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
      if (data.settings) setSettings(data.settings as TenantSettings);

      localStorage.setItem("tenantName", updatedTenant.name);
      localStorage.setItem("tenantSlug", updatedTenant.slug);
      toast.success("Workspace updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update workspace");
    } finally {
      setSavingTenant(false);
    }
  }

  async function saveSubscription() {
    if (!isSuperAdmin) return;
    try {
      setSavingSubscription(true);
      const targetTenantId = selectedPlatformTenantId || tenant?.id;
      if (!targetTenantId) {
        toast.error("Select a tenant first");
        return;
      }

      const payload = {
        subscriptionStatus: subscriptionForm.subscriptionStatus,
        currentPeriodEndAt: subscriptionForm.currentPeriodEndDate
          ? new Date(`${subscriptionForm.currentPeriodEndDate}T23:59:59`).toISOString()
          : null,
        graceEndsAt: subscriptionForm.graceEndDate
          ? new Date(`${subscriptionForm.graceEndDate}T23:59:59`).toISOString()
          : null,
      };

      if (payload.subscriptionStatus === "GRACE" && !payload.graceEndsAt) {
        toast.error("Grace End Date is required when status is GRACE");
        return;
      }

      if (payload.currentPeriodEndAt && payload.graceEndsAt) {
        const currentEndMs = new Date(payload.currentPeriodEndAt).getTime();
        const graceEndMs = new Date(payload.graceEndsAt).getTime();
        if (graceEndMs < currentEndMs) {
          toast.error("Grace End Date cannot be before Current Period End Date");
          return;
        }
      }

      const data = await apiFetch(`/api/platform/tenants/${targetTenantId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const updatedTenant: Tenant = data.tenant || data;
      setPlatformTenants((prev) => prev.map((t) => (t.id === updatedTenant.id ? updatedTenant : t)));
      const isCurrentWorkspace = tenant?.id === updatedTenant.id;
      if (isCurrentWorkspace) setTenant(updatedTenant);
      setSubscriptionForm({
        subscriptionStatus: updatedTenant.subscriptionStatus || "ACTIVE",
        currentPeriodEndDate: toDateInput(updatedTenant.currentPeriodEndAt),
        graceEndDate: toDateInput(updatedTenant.graceEndsAt),
      });

      if (isCurrentWorkspace) {
        localStorage.setItem("subscriptionStatus", updatedTenant.subscriptionStatus || "ACTIVE");
        localStorage.setItem("subscriptionCurrentPeriodEndAt", updatedTenant.currentPeriodEndAt || "");
        localStorage.setItem(
          "subscriptionDaysToExpiry",
          updatedTenant.daysToExpiry != null ? String(updatedTenant.daysToExpiry) : ""
        );
      }

      toast.success("Subscription status updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update subscription");
    } finally {
      setSavingSubscription(false);
    }
  }

  async function createTenantWorkspace() {
    if (!isSuperAdmin) return;
    if (!createTenantForm.name.trim()) return toast.error("Tenant name is required");
    if (!createTenantForm.slug.trim()) return toast.error("Tenant slug is required");
    if (!isValidSlug(createTenantForm.slug.trim())) {
      return toast.error("Tenant slug must be lowercase letters, numbers, and hyphens only");
    }
    if (createTenantForm.email.trim() && !isValidEmail(createTenantForm.email.trim())) {
      return toast.error("Tenant contact email is invalid");
    }
    if (!createTenantForm.adminEmail.trim()) return toast.error("First admin email is required");
    if (!isValidEmail(createTenantForm.adminEmail.trim())) return toast.error("First admin email is invalid");
    if (!createTenantForm.adminPassword || createTenantForm.adminPassword.length < 8) {
      return toast.error("First admin password must be at least 8 characters");
    }

    const minDepositPercent = Number.parseInt(createTenantForm.minDepositPercent, 10);
    const maxProperties = Number.parseInt(createTenantForm.maxProperties, 10);
    const maxUnits = Number.parseInt(createTenantForm.maxUnits, 10);
    const maxUsers = Number.parseInt(createTenantForm.maxUsers, 10);

    if (!Number.isInteger(minDepositPercent) || minDepositPercent < 0 || minDepositPercent > 100) {
      return toast.error("Min deposit must be an integer between 0 and 100");
    }
    if (!Number.isInteger(maxProperties) || maxProperties < 1) {
      return toast.error("Max properties must be an integer >= 1");
    }
    if (!Number.isInteger(maxUnits) || maxUnits < 1) {
      return toast.error("Max units must be an integer >= 1");
    }
    if (!Number.isInteger(maxUsers) || maxUsers < 1) {
      return toast.error("Max users must be an integer >= 1");
    }

    const currentPeriodEndAt = createTenantForm.currentPeriodEndDate
      ? new Date(`${createTenantForm.currentPeriodEndDate}T23:59:59`).toISOString()
      : null;
    const graceEndsAt = createTenantForm.graceEndDate
      ? new Date(`${createTenantForm.graceEndDate}T23:59:59`).toISOString()
      : null;

    if (createTenantForm.subscriptionStatus === "GRACE" && !graceEndsAt) {
      return toast.error("Grace end date is required when subscription is GRACE");
    }
    if (currentPeriodEndAt && graceEndsAt) {
      const currentMs = new Date(currentPeriodEndAt).getTime();
      const graceMs = new Date(graceEndsAt).getTime();
      if (graceMs < currentMs) {
        return toast.error("Grace end date cannot be before current period end date");
      }
    }

    try {
      setCreatingTenant(true);
      const data = await apiFetch("/api/platform/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: createTenantForm.name.trim(),
          slug: createTenantForm.slug.trim(),
          email: createTenantForm.email.trim() || null,
          phone: createTenantForm.phone.trim() || null,
          address: createTenantForm.address.trim() || null,
          subscriptionStatus: createTenantForm.subscriptionStatus,
          currentPeriodEndAt,
          graceEndsAt,
          settings: {
            minDepositPercent,
            maxProperties,
            maxUnits,
            maxUsers,
          },
          adminUser: {
            email: createTenantForm.adminEmail.trim(),
            password: createTenantForm.adminPassword,
            fullName: createTenantForm.adminFullName.trim() || null,
            phone: createTenantForm.adminPhone.trim() || null,
          },
        }),
      });

      const createdTenant: Tenant | null = data?.tenant || null;
      await loadPlatformTenants(createdTenant?.id);

      setCreateTenantForm({
        name: "",
        slug: "",
        email: "",
        phone: "",
        address: "",
        subscriptionStatus: "ACTIVE",
        currentPeriodEndDate: "",
        graceEndDate: "",
        minDepositPercent: "100",
        maxProperties: "20",
        maxUnits: "500",
        maxUsers: "100",
        adminEmail: "",
        adminPassword: "",
        adminFullName: "",
        adminPhone: "",
      });

      toast.success("Tenant workspace created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create tenant workspace");
    } finally {
      setCreatingTenant(false);
    }
  }

  async function savePolicyLimits() {
    if (!isSuperAdmin) return;
    const targetTenantId = selectedPlatformTenantId || tenant?.id;
    if (!targetTenantId) return toast.error("Select a tenant first");

    const minDepositPercent = Number.parseInt(policyForm.minDepositPercent, 10);
    const maxProperties = Number.parseInt(policyForm.maxProperties, 10);
    const maxUnits = Number.parseInt(policyForm.maxUnits, 10);
    const maxUsers = Number.parseInt(policyForm.maxUsers, 10);

    if (!Number.isInteger(minDepositPercent) || minDepositPercent < 0 || minDepositPercent > 100) {
      return toast.error("Min deposit must be an integer between 0 and 100");
    }
    if (!Number.isInteger(maxProperties) || maxProperties < 1) {
      return toast.error("Max properties must be an integer >= 1");
    }
    if (!Number.isInteger(maxUnits) || maxUnits < 1) {
      return toast.error("Max units must be an integer >= 1");
    }
    if (!Number.isInteger(maxUsers) || maxUsers < 1) {
      return toast.error("Max users must be an integer >= 1");
    }

    try {
      setSavingPolicyLimits(true);
      const data = await apiFetch(`/api/platform/tenants/${targetTenantId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          minDepositPercent,
          maxProperties,
          maxUnits,
          maxUsers,
        }),
      });

      const updatedSettings = data?.settings || null;
      const updatedTenant = data?.tenant || null;
      setPolicyForm(toPolicyForm(updatedSettings));
      setSettings((prev) => (tenant?.id === targetTenantId ? updatedSettings || prev : prev));
      setPlatformTenants((prev) =>
        prev.map((t) =>
          t.id === targetTenantId
            ? {
                ...t,
                ...(updatedTenant || {}),
                settings: updatedSettings || t.settings || null,
              }
            : t
        )
      );

      toast.success("Tenant policy and limits updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update tenant policy and limits");
    } finally {
      setSavingPolicyLimits(false);
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Workspace profile, tenant policy settings, and plan usage visibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={boot}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => loadUsageData(true)} disabled={refreshingUsage}>
            <Gauge className={`mr-2 h-4 w-4 ${refreshingUsage ? "animate-spin" : ""}`} />
            Refresh Usage
          </Button>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Tenant Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tenant ? (
            <p className="text-sm text-muted-foreground">Workspace details not available.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Workspace ID:</span>{" "}
                <span className="font-mono text-slate-700">{tenant.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span className={`font-semibold ${tenant.status === "ACTIVE" ? "text-emerald-700" : "text-amber-700"}`}>
                  {tenant.status}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Subscription:</span>{" "}
                <span className="font-semibold">{tenant.subscriptionStatus || "ACTIVE"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Current period ends:</span>{" "}
                <span className="font-medium">{formatDateTime(tenant.currentPeriodEndAt || undefined)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Days to expiry:</span>{" "}
                <span className="font-medium">
                  {typeof tenant.daysToExpiry === "number" ? tenant.daysToExpiry : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Your role:</span>{" "}
                <span className="font-semibold">{userRole}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Slug:</span>{" "}
                <span className="font-semibold">{tenant.slug || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                <span className="font-medium">{formatDateTime(tenant.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last updated:</span>{" "}
                <span className="font-medium">{formatDateTime(tenant.updatedAt)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin ? (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              Create Tenant Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tenant Name</Label>
                <Input
                  value={createTenantForm.name}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Stays Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label>Tenant Slug</Label>
                <Input
                  value={createTenantForm.slug}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, slug: e.target.value }))}
                  placeholder="acme-stays"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  value={createTenantForm.email}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="ops@acmestays.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  value={createTenantForm.phone}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+2348000000000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={createTenantForm.address}
                onChange={(e) => setCreateTenantForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Lagos, Nigeria"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Subscription Status</Label>
                <select
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                  value={createTenantForm.subscriptionStatus}
                  onChange={(e) =>
                    setCreateTenantForm((p) => ({
                      ...p,
                      subscriptionStatus: e.target.value as "ACTIVE" | "GRACE" | "SUSPENDED",
                    }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="GRACE">GRACE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Current Period End Date</Label>
                <Input
                  type="date"
                  value={createTenantForm.currentPeriodEndDate}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, currentPeriodEndDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Grace End Date</Label>
                <Input
                  type="date"
                  value={createTenantForm.graceEndDate}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, graceEndDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Min Deposit %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={createTenantForm.minDepositPercent}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, minDepositPercent: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Properties</Label>
                <Input
                  type="number"
                  min={1}
                  value={createTenantForm.maxProperties}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, maxProperties: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Units</Label>
                <Input
                  type="number"
                  min={1}
                  value={createTenantForm.maxUnits}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, maxUnits: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input
                  type="number"
                  min={1}
                  value={createTenantForm.maxUsers}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, maxUsers: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Admin Email</Label>
                <Input
                  value={createTenantForm.adminEmail}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, adminEmail: e.target.value }))}
                  placeholder="admin@acmestays.com"
                />
              </div>
              <div className="space-y-2">
                <Label>First Admin Password</Label>
                <Input
                  type="password"
                  value={createTenantForm.adminPassword}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, adminPassword: e.target.value }))}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label>First Admin Full Name (optional)</Label>
                <Input
                  value={createTenantForm.adminFullName}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, adminFullName: e.target.value }))}
                  placeholder="Workspace Admin"
                />
              </div>
              <div className="space-y-2">
                <Label>First Admin Phone (optional)</Label>
                <Input
                  value={createTenantForm.adminPhone}
                  onChange={(e) => setCreateTenantForm((p) => ({ ...p, adminPhone: e.target.value }))}
                  placeholder="+2348111111111"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={createTenantWorkspace} disabled={creatingTenant}>
                <Save className="mr-2 h-4 w-4" />
                {creatingTenant ? "Creating..." : "Create Tenant"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-indigo-600" />
            Subscription Access Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSuperAdmin ? (
            <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              View only. Only platform Super Admin can update subscription state.
            </div>
          ) : null}

          {isSuperAdmin ? (
            <div className="space-y-2">
              <Label>Target Tenant</Label>
              <select
                className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                value={selectedPlatformTenantId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedPlatformTenantId(nextId);
                  const selected = platformTenants.find((t) => t.id === nextId);
                  setSubscriptionForm({
                    subscriptionStatus: selected?.subscriptionStatus || "ACTIVE",
                    currentPeriodEndDate: toDateInput(selected?.currentPeriodEndAt),
                    graceEndDate: toDateInput(selected?.graceEndsAt),
                  });
                  setPolicyForm(toPolicyForm(selected?.settings));
                }}
              >
                {!platformTenants.length ? <option value="">No tenants available</option> : null}
                {platformTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
              {selectedPlatformTenantId ? (
                <p className="text-xs text-muted-foreground">
                  Updating:{" "}
                  <span className="font-medium text-slate-900">
                    {platformTenants.find((t) => t.id === selectedPlatformTenantId)?.name || "Selected tenant"}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Subscription Status</Label>
              <select
                className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                value={subscriptionForm.subscriptionStatus}
                disabled={!isSuperAdmin}
                onChange={(e) =>
                  setSubscriptionForm((p) => ({
                    ...p,
                    subscriptionStatus: e.target.value as "ACTIVE" | "GRACE" | "SUSPENDED",
                  }))
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="GRACE">GRACE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Current Period End Date</Label>
              <Input
                type="date"
                value={subscriptionForm.currentPeriodEndDate}
                disabled={!isSuperAdmin}
                onChange={(e) => setSubscriptionForm((p) => ({ ...p, currentPeriodEndDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Grace End Date</Label>
              <Input
                type="date"
                value={subscriptionForm.graceEndDate}
                disabled={!isSuperAdmin}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSubscriptionForm((p) => ({ ...p, graceEndDate: e.target.value }))
                }
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Setting status to <b>SUSPENDED</b> blocks tenant login immediately. Restoring to <b>ACTIVE</b> allows login
            again.
          </p>

          {isSuperAdmin ? (
            <div className="flex justify-end">
              <Button onClick={saveSubscription} disabled={savingSubscription || !subscriptionChanged}>
                <Save className="mr-2 h-4 w-4" />
                {savingSubscription ? "Applying..." : "Apply Subscription Changes"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            Workspace Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tenant ? (
            <div className="text-sm text-muted-foreground">Workspace details not available.</div>
          ) : (
            <>
              {!isAdmin ? (
                <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                  View only. Only Admin can edit workspace profile details.
                </div>
              ) : null}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input
                    value={tenantForm.name}
                    disabled={!isAdmin}
                    onChange={onTenantFieldChange("name")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Workspace Slug</Label>
                  <Input
                    value={tenantForm.slug}
                    disabled={!isAdmin}
                    onChange={onTenantFieldChange("slug")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    value={tenantForm.email}
                    disabled={!isAdmin}
                    onChange={onTenantFieldChange("email")}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={tenantForm.phone}
                    disabled={!isAdmin}
                    onChange={onTenantFieldChange("phone")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={tenantForm.address}
                  disabled={!isAdmin}
                  onChange={onTenantFieldChange("address")}
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

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-indigo-600" />
            Tenant Policy & Plan Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!effectiveSettings ? (
            <div className="text-sm text-muted-foreground">Tenant settings not available.</div>
          ) : (
            <>
              {isSuperAdmin ? (
                <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                  Super Admin control: update policy and limits for the selected tenant.
                </div>
              ) : null}

              {isSuperAdmin ? (
                <div className="space-y-2">
                  <Label>Target Tenant</Label>
                  <select
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                    value={selectedPlatformTenantId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedPlatformTenantId(nextId);
                      const selected = platformTenants.find((t) => t.id === nextId);
                      setSubscriptionForm({
                        subscriptionStatus: selected?.subscriptionStatus || "ACTIVE",
                        currentPeriodEndDate: toDateInput(selected?.currentPeriodEndAt),
                        graceEndDate: toDateInput(selected?.graceEndsAt),
                      });
                      setPolicyForm(toPolicyForm(selected?.settings));
                    }}
                  >
                    {!platformTenants.length ? <option value="">No tenants available</option> : null}
                    {platformTenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-muted-foreground">Minimum Deposit Required</p>
                  <p className="text-xl font-semibold mt-1">{effectiveSettings.minDepositPercent}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Applied during check-in validation for deposit control.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-muted-foreground">Settings Last Updated</p>
                  <p className="text-sm font-medium mt-1">{formatDateTime(effectiveSettings.updatedAt)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isSuperAdmin ? "Changes apply immediately after save." : "Settings are managed by platform Super Admin."}
                  </p>
                </div>
              </div>

              {isSuperAdmin ? (
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Min Deposit %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={policyForm.minDepositPercent}
                      onChange={(e) => setPolicyForm((p) => ({ ...p, minDepositPercent: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Properties</Label>
                    <Input
                      type="number"
                      min={1}
                      value={policyForm.maxProperties}
                      onChange={(e) => setPolicyForm((p) => ({ ...p, maxProperties: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Units</Label>
                    <Input
                      type="number"
                      min={1}
                      value={policyForm.maxUnits}
                      onChange={(e) => setPolicyForm((p) => ({ ...p, maxUnits: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Users</Label>
                    <Input
                      type="number"
                      min={1}
                      value={policyForm.maxUsers}
                      onChange={(e) => setPolicyForm((p) => ({ ...p, maxUsers: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <h3 className="font-semibold text-sm">Usage vs Plan Limits</h3>

                <ProgressRow
                  label="Properties"
                  current={usage.propertiesCount}
                  limit={effectiveSettings.maxProperties}
                />
                <ProgressRow
                  label="Units"
                  current={usage.unitsCount}
                  limit={effectiveSettings.maxUnits}
                  hidden={!usage.canViewUnits}
                />
                <ProgressRow
                  label="Users"
                  current={usage.usersCount}
                  limit={effectiveSettings.maxUsers}
                  hidden={!usage.canViewUsers}
                />

                {!canViewUsersUnits ? (
                  <p className="text-xs text-muted-foreground">
                    Units/users counts require Manager or Admin access.
                  </p>
                ) : null}
              </div>

              {isSuperAdmin ? (
                <div className="flex justify-end">
                  <Button onClick={savePolicyLimits} disabled={savingPolicyLimits || !policyChanged}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingPolicyLimits ? "Saving..." : "Apply Policy & Limit Changes"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
