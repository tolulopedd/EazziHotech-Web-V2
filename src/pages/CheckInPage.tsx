import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CalendarCheck2, RefreshCcw, Clipboard, CheckCircle2 } from "lucide-react";

type Booking = {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  totalAmount?: string | null;
  currency?: string | null;
  unit?: {
    id: string;
    name: string;
    type: "ROOM" | "APARTMENT";
    property?: { name: string };
  };
};

export default function CheckInPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const count = useMemo(() => bookings.length, [bookings]);

  async function loadArrivals() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/api/bookings/arrivals/today");
      setBookings((data?.bookings ?? []) as Booking[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load arrivals");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(bookingId: string) {
    setError("");
    setBusyId(bookingId);
    try {
      await apiFetch(`/api/bookings/${bookingId}/check-in`, {
        method: "POST",
        body: JSON.stringify({ notes: "Checked in from frontend" }),
      });
      await loadArrivals();
    } catch (e: any) {
      setError(e?.message || "Check-in failed");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadArrivals();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check In</h1>
          <p className="text-muted-foreground mt-2">
            Confirm arrivals for today and check guests into their assigned units.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadArrivals} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm">
            Arrivals today: <span className="font-semibold text-indigo-700">{count}</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Couldn’t load arrivals</p>
              <p className="text-sm text-red-700/80 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-indigo-600" />
            Today’s Arrivals
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-200 mx-auto" />
                <p className="text-muted-foreground">Loading arrivals…</p>
              </div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CalendarCheck2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No arrivals found for today.</p>
              <p className="text-xs mt-1">If you expect arrivals, confirm the backend endpoint exists.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const unitName = b.unit?.name ?? "Unit";
                const propertyName = b.unit?.property?.name;
                const title = propertyName ? `${propertyName} — ${unitName}` : unitName;

                const canCheckIn = b.status === "CONFIRMED";
                const isBusy = busyId === b.id;

                return (
                  <div
                    key={b.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50/60 transition"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate">
                            {b.guestName || "Guest"}
                          </p>
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
                            Check-in:{" "}
                            <span className="font-medium text-slate-700">
                              {new Date(b.checkIn).toLocaleString()}
                            </span>
                          </span>
                          <span>
                            Check-out:{" "}
                            <span className="font-medium text-slate-700">
                              {new Date(b.checkOut).toLocaleString()}
                            </span>
                          </span>

                          {b.totalAmount ? (
                            <span>
                              Total:{" "}
                              <span className="font-medium text-slate-700">
                                {b.totalAmount} {b.currency || "NGN"}
                              </span>
                            </span>
                          ) : null}

                          {b.guestPhone ? (
                            <span>
                              Phone:{" "}
                              <span className="font-medium text-slate-700">
                                {b.guestPhone}
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

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => handleCheckIn(b.id)}
                        disabled={!canCheckIn || isBusy}
                      >
                        {isBusy ? (
                          <>
                            <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                            Checking in…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Check-in
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

                      {!canCheckIn ? (
                        <span className="text-xs text-muted-foreground">
                          Only <b>CONFIRMED</b> bookings can be checked in.
                        </span>
                      ) : null}
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
