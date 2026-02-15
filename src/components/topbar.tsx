import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Menu, LogOut, User } from "lucide-react";



import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { Sidebar } from "@/components/sidebar";
import { apiFetch, clearAuthSession } from "@/lib/api";

type TenantSubscriptionSnapshot = {
  subscriptionStatus?: string;
  currentPeriodEndAt?: string | null;
  daysToExpiry?: number | null;
};

function buildSubscriptionNotice(input: TenantSubscriptionSnapshot | null) {
  if (!input) return null;
  const status = String(input.subscriptionStatus || "ACTIVE").toUpperCase();
  const days = typeof input.daysToExpiry === "number" ? input.daysToExpiry : null;
  const endAt = input.currentPeriodEndAt ? new Date(input.currentPeriodEndAt) : null;
  const endLabel = endAt && !Number.isNaN(endAt.getTime()) ? endAt.toLocaleDateString() : null;

  if (status === "SUSPENDED") {
    return {
      tone: "red" as const,
      text: "Subscription suspended. Renew to regain access.",
    };
  }

  if (status === "GRACE") {
    return {
      tone: "red" as const,
      text: endLabel
        ? `Subscription in grace period. Service may pause soon (period ended ${endLabel}).`
        : "Subscription in grace period. Service may pause soon.",
    };
  }

  if (days !== null && days >= 0 && days <= 3) {
    return {
      tone: "amber" as const,
      text: `Subscription expires in ${days} day${days === 1 ? "" : "s"}. Renew to avoid interruption.`,
    };
  }

  return null;
}

export function Topbar({ onMenu }: { onMenu?: () => void })  {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [subscriptionNotice, setSubscriptionNotice] = useState<{
    tone: "amber" | "red";
    text: string;
  } | null>(null);

  const tenantName = localStorage.getItem("tenantName") || "Workspace";
  const tenantSlug = localStorage.getItem("tenantSlug") || "";

  const userName = localStorage.getItem("userName") || "User";
  const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();

  function goProfile() {
    nav("/app/profile");
  }

  function logout() {
    // clear token + refresh token
    clearAuthSession();

    // ✅ also clear tenant/user display data (prevents stale UI)
    localStorage.removeItem("tenantId");
    localStorage.removeItem("tenantName");
    localStorage.removeItem("tenantSlug");
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("isSuperAdmin");
    localStorage.removeItem("subscriptionStatus");
    localStorage.removeItem("subscriptionCurrentPeriodEndAt");
    localStorage.removeItem("subscriptionDaysToExpiry");

    toast.success("Logged out");
    nav("/login");
  }

  const [ngTime, setNgTime] = useState("");

useEffect(() => {
  function updateTime() {
    const formatter = new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",

      hour12: true,
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

    setNgTime(formatter.format(new Date()));
  }

  updateTime(); // initial
  const timer = setInterval(updateTime, 30_000); // update every 30s

  return () => clearInterval(timer);
}, []);

  useEffect(() => {
    const localSnapshot: TenantSubscriptionSnapshot = {
      subscriptionStatus: localStorage.getItem("subscriptionStatus") || undefined,
      currentPeriodEndAt: localStorage.getItem("subscriptionCurrentPeriodEndAt"),
      daysToExpiry: localStorage.getItem("subscriptionDaysToExpiry")
        ? Number(localStorage.getItem("subscriptionDaysToExpiry"))
        : null,
    };
    setSubscriptionNotice(buildSubscriptionNotice(localSnapshot));

    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch("/api/tenant");
        const tenant = data?.tenant || {};
        const snapshot: TenantSubscriptionSnapshot = {
          subscriptionStatus: tenant.subscriptionStatus,
          currentPeriodEndAt: tenant.currentPeriodEndAt,
          daysToExpiry: tenant.daysToExpiry,
        };

        localStorage.setItem("subscriptionStatus", snapshot.subscriptionStatus || "ACTIVE");
        localStorage.setItem("subscriptionCurrentPeriodEndAt", snapshot.currentPeriodEndAt || "");
        localStorage.setItem(
          "subscriptionDaysToExpiry",
          snapshot.daysToExpiry != null ? String(snapshot.daysToExpiry) : ""
        );

        if (!cancelled) {
          setSubscriptionNotice(buildSubscriptionNotice(snapshot));
        }
      } catch {
        // silent
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  return (
    <header className="sticky top-0 z-30 border-b border-indigo-100 bg-gradient-to-b from-slate-50 via-white to-slate-100 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
<Button
  variant="ghost"
  size="icon"
  className="md:hidden"
  onClick={onMenu}
>
  <Menu className="h-5 w-5" />
</Button>
              </SheetTrigger>

              <SheetContent side="left" className="w-72 p-0">
                <Sidebar onNavigate={() => setOpen(false)} />
                <Separator />
              </SheetContent>
            </Sheet>
          </div>

          {/* Workspace pill */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold tracking-tight text-indigo-700">
                {tenantName}
              </div>
              {tenantSlug ? (
                <span className="hidden sm:inline-flex rounded-full border border-indigo-50 bg-white px-2 py-0.5 text-xs text-muted-foreground">
                  @{tenantSlug}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Manage properties, bookings & payments
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-indigo-900 text-muted-foreground capitalize">{userRole}</p>
            <p className="text-xs font-medium text-indigo-700">{userName}</p>

          </div>

{/* Nigerian Time */}
<div className="hidden md:flex flex-col items-end px-2">
  <span className="text-sm text-indigo-900  text-muted-foreground">Nigeria Time</span>
  <span className="text-xs font-medium text-indigo-500 leading-tight">
    {ngTime}
  </span>
</div>

          {/* Profile button */}
          <Button
            variant="ghost"
            className="rounded-lg flex items-center gap-2"
            onClick={goProfile}
            title="My Profile"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-medium text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            
            <User className="h-4 w-4 text-indigo-700 md:hidden" />
          </Button>

          {/* Logout */}
          <Button
            variant="ghost"
            onClick={logout}
            className="text-indigo-700 rounded-lg"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {subscriptionNotice ? (
        <div
          className={
            subscriptionNotice.tone === "red"
              ? "border-t border-red-200 bg-red-50 px-4 md:px-6 py-2 text-sm text-red-700"
              : "border-t border-amber-200 bg-amber-50 px-4 md:px-6 py-2 text-sm text-amber-700"
          }
        >
          {subscriptionNotice.text}
        </div>
      ) : null}
    </header>
  );
}
