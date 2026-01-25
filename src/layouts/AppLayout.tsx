import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:block md:w-64 md:border border-slate-300 md:bg-background">
          <Sidebar />
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col">
          <Topbar />

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
