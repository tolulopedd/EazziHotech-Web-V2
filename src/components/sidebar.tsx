import { NavLink, useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  CalendarCheck2,
  CreditCard,
  Settings,
  LogOut,
  Users,
  ChevronsUpDown,
  DoorOpen,
  DoorClosed,
} from "lucide-react";
import logo from "@/assets/logo512.png";

import { toast } from "sonner";
import { clearAuthSession } from "@/lib/api";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNavigate();
  const tenantName = localStorage.getItem("tenantName") || "Workspace";
  const tenantSlug = localStorage.getItem("tenantSlug") || "";

  const items = [
    { label: "Dashboard", to: "/app/dashboard", icon: LayoutDashboard },
    { label: "Properties", to: "/app/properties", icon: Building2 },
    { label: "Bookings", to: "/app/bookings", icon: CalendarCheck2 },
        { label: "Payments", to: "/app/payments", icon: CreditCard },
      { label: "Check In", to: "/app/check-in", icon: DoorOpen },
  { label: "Check Out", to: "/app/check-out", icon: DoorClosed },
    { label: "Settings", to: "/app/settings", icon: Settings },
    { label: "Users Management", to: "/app/users", icon: Users },

  ];

  function logout() {
    clearAuthSession();
    toast.success("Logged out");
    nav("/login");
  }

  return (
    <div className="flex h-full flex-col bg-white-50 rounded-2xl border border-indigo-50 shadow-xsm">
      {/* Brand / Workspace */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center gap-3">
         <div className="h-10 w-10 rounded-3xl ring-1 ring-indigo-400 overflow-hidden bg-white">
  <img
    src={logo}
    alt="EazziHotech logo"
    className="h-full w-full object-contain"
  />
</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-indigo-700">EazziHotech</div>
            
          </div>
        </div>
      </div>

      <Separator />

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-6">
        <nav className="space-y-1">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cx(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-100",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-50"
                      : "text-muted-foreground hover:bg-slate-50 hover:text-indigo-700"
                  )
                }
              >
                <Icon
                  className={cx(
                    "h-4 w-4 transition",
                    "group-hover:opacity-100",
                    "opacity-80"
                  )}
                />
                <span className="font-medium">{it.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Separator />

      {/* Footer */}
      <div className="p-3">
        <Button
          variant="ghost"
          className="w-full justify-start rounded-xl text-indigo-700 hover:bg-slate-50"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>

        <div className="mt-3 px-2 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} EazziHotech
        </div>
      </div>
    </div>
  );
}