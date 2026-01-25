import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Menu, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { Sidebar } from "@/components/sidebar";
import { clearAuthSession } from "@/lib/api";

export function Topbar() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const tenantName = localStorage.getItem("tenantName") || "Workspace";
  const tenantSlug = localStorage.getItem("tenantSlug") || "";

  function logout() {
    clearAuthSession();
    toast.success("Logged out");
    nav("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-indigo-100 bg-gradient-to-b from-slate-50 via-white to-slate-100 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl border-indigo-100 text-indigo-700">
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
    {/* Right actions */}
<div className="flex items-center gap-3">
  <div className="text-right hidden sm:block">
    <p className="text-sm font-medium text-slate-900">
      {localStorage.getItem("userName") || "User"}
    </p>
    <p className="text-xs text-muted-foreground capitalize">
      {localStorage.getItem("userRole") || "staff"}
    </p>
  </div>
  
  <Button 
    variant="ghost" 
    size="icon" 
    className="rounded-lg"
  >
    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-medium text-sm">
      {(localStorage.getItem("userName") || "U").charAt(0).toUpperCase()}
    </div>
  </Button>

  <Button 
    variant="ghost" 
    onClick={logout} 
    className="text-indigo-700 rounded-lg"
  >
    <LogOut className="h-4 w-4" />
  </Button>
</div>
      </div>
    </header>
  );
}