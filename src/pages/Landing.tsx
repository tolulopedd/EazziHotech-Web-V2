import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="font-bold text-lg">EazziHotech</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              Features
            </Button>
            <Button variant="outline" onClick={() => nav("/login")}>
              Login
            </Button>
            <Button onClick={() => nav("/login")}>Get started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-indigo-300 py-2 px-3 bg-indigo-50 text-sm text-muted-foreground">
              Hotel & Shortlet Management Platform
            </div>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Manage hotels and shortlet apartments in one modern workspace.
            </h1>

            <p className="text-lg text-muted-foreground">
              Bookings, units, payments (manual or automated), check-in/check-out workflows, user management
              and multi-tenant workspaces—built for speed and clarity.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => nav("/login")}>
                Get started
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
                View features
              </Button>
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Check className="h-4 w-4" /> Multi-tenant workspaces</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4" /> Hotel + shortlet support</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4" /> Manual payment confirmation</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4" /> Guest information management</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4" /> Email notifications to guests</div>
            </div>
          </div>

          {/* Right side visual */}
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-sm font-medium text-muted-foreground">Preview from Dashboard</div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-semibold">Today</div>
                  <div className="mt-3 grid gap-3">
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold">Check-ins</div>
                      <div className="text-xs text-muted-foreground">3 arrivals expected</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold">Pending payments</div>
                      <div className="text-xs text-muted-foreground">2 bank transfers to confirm</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold">Available units</div>
                      <div className="text-xs text-muted-foreground">6 units ready for booking</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold">Occupancy Rate</div>
                      <div className="text-xs text-muted-foreground">15.5% month till date</div>
                    </div>
                  </div>
                </div>
                

                <div className="text-xs text-muted-foreground">
                  *Dashboard preview only. Live data appears after login.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-8 space-y-2">
          <h2 className="text-3xl font-bold">Features built for operators</h2>
          <p className="text-muted-foreground">
            Everything you need to run day-to-day operations of your business—without complexity.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Properties & Units", desc: "Manage hotels and shortlet apartments as properties with bookable units." },
            { title: "Bookings", desc: "Create, modify, and track guest bookings across date ranges." },
            { title: "Manual Payments", desc: "Confirm bank transfers manually now; with option to integrate payment gateways." },
            { title: "Staff Roles", desc: "Admin/Manager/Staff role access for secure operations." },
            { title: "Check-in / Check-out", desc: "Capture verification at check-in/out (face verification planned)." },
            { title: "Multi-tenant", desc: "Separate workspaces per organization using tenant isolation." },
          ].map((f) => (
            <Card key={f.title} className="shadow-sm">
              <CardContent className="p-6 space-y-2">
                <div className="font-semibold">{f.title}</div>
                <div className="text-sm text-muted-foreground">{f.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 md:flex-row md:items-center md:justify-center">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} EazziHotech. All rights reserved.
          </div>
  
        </div>
      </footer>
    </div>
  );
}
