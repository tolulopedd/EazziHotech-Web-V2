import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        {/* ✅ Mobile backdrop */}
        <div
          className={cx(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity md:hidden",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ✅ Mobile slide-in sidebar */}
        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 ease-out md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ willChange: "transform" }}
        >
          {/* optional: give it padding so it doesn't touch the screen edges */}
          <div className="h-full p-3">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </aside>

        {/* Desktop sidebar */}
        <aside className="hidden md:block md:w-64 md:border border-slate-300 md:bg-background">
          <Sidebar />
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col">
          {/* ✅ Pass opener to Topbar */}
          <Topbar onMenu={() => setSidebarOpen(true)} />

          <main id="dialog-scope" className="relative flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-6xl">
              <div className="rounded-xl bg-background p-4 md:p-6 shadow-sm">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
