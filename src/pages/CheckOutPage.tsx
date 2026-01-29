import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Clipboard,
  DoorClosed,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";

type Booking = {
  id: string;
  status: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  checkedInAt?: string | null;
  unit?: {
    name: string;
    type: "ROOM" | "APARTMENT";
    property?: { name: string };
  };
};

export default function CheckOutPage() {
  const [q, setQ] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const count = useMemo(() => bookings.length, [bookings]);

  async function loadInHouse(search = "") {
    setError("");
    setLoading(true);
    try {
      const qs = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const data = await apiFetch(`/api/bookings/inhouse${qs}`);
      setBookings((data?.bookings ?? []) as Booking[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load in-house guests");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut(bookingId: string) {
    setError("");
    setBusyId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/check-out`, {
        method: "POST",
        body: JSON.stringify({ notes: "Checked out from frontend" }),
      });

      await loadInHouse(q);
    } catch (e: any) {
      setError(e?.message || "Check-out failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSearch() {
    await loadInHouse(q);
  }

  useEffect(() => {
    loadInHouse("");
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check Out</h1>
          <p className="text-muted-foreground mt-2">
            Search in-house guests and complete check-out.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadInHouse(q)} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm">
            In-house: <span className="font-semibold text-indigo-700">{count}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <label className="text-sm font-medium">Search</label>
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Guest name, phone, unit, property…"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                  />
                </div>

                <Button onClick={handleSearch} disabled={loading}>
                  Search
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    loadInHouse("");
                  }}
                  disabled={loading && !q}
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tip: press <b>Enter</b> to search quickly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error ? (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Couldn’t load in-house guests</p>
              <p className="text-sm text-red-700/80 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* In-house List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            In-house Guests
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-200 mx-auto" />
                <p className="text-muted-foreground">Loading in-house guests…</p>
              </div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No guests currently checked in.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const unitName = b.unit?.name ?? "Unit";
                const propertyName = b.unit?.property?.name;
                const title = propertyName ? `${propertyName} — ${unitName}` : unitName;

                const isBusy = busyId === b.id;

                return (
                  <div
                    key={b.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate">{b.guestName || "Guest"}</p>
                          <span className="text-muted-foreground">•</span>
                          <p className="text-sm text-muted-foreground truncate">
                            <span className="font-medium text-slate-900">{title}</span>{" "}
                            {b.unit?.type ? (
                              <span className="text-xs text-muted-foreground">
                                ({b.unit.type})
                              </span>
                            ) : null}
                          </p>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                          <span>
                            Checked-in at:{" "}
                            <span className="font-medium text-slate-700">
                              {b.checkedInAt
                                ? new Date(b.checkedInAt).toLocaleString()
                                : "n/a"}
                            </span>
                          </span>

                          {b.guestPhone ? (
                            <span>
                              Phone:{" "}
                              <span className="font-medium text-slate-700">
                                {b.guestPhone}
                              </span>
                            </span>
                          ) : null}

                          {b.guestEmail ? (
                            <span>
                              Email:{" "}
                              <span className="font-medium text-slate-700">
                                {b.guestEmail}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium">
                          Status: <span className="ml-1 font-semibold">{b.status}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => handleCheckOut(b.id)} disabled={isBusy}>
                        {isBusy ? (
                          <>
                            <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                            Checking out…
                          </>
                        ) : (
                          <>
                            <DoorClosed className="mr-2 h-4 w-4" />
                            Check-out
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(b.id)}
                      >
                        <Clipboard className="mr-2 h-4 w-4" />
                        Copy Booking ID
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
