import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [networkBusy, setNetworkBusy] = useState(false);

  useEffect(() => {
    const onNetwork = (event: Event) => {
      const detail = (event as CustomEvent<{ inFlight?: number }>).detail;
      const inFlight = Number(detail?.inFlight || 0);
      setNetworkBusy(inFlight > 0);
    };
    window.addEventListener("app:network", onNetwork as EventListener);
    return () => window.removeEventListener("app:network", onNetwork as EventListener);
  }, []);

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
            "fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-0.75rem))] bg-white shadow-xl transform transition-transform duration-300 ease-out md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ willChange: "transform" }}
        >
          <div className="h-full p-2">
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
          {networkBusy ? (
            <div className="h-1 w-full overflow-hidden bg-indigo-100">
              <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-indigo-600" />
            </div>
          ) : null}

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
