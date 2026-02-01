import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle,
  Clipboard,
  DoorClosed,
  RefreshCcw,
  Search,
  Users,
  ShieldCheck,
} from "lucide-react";

type Booking = {
  id: string;
  status: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  checkedInAt?: string | null;
  totalAmount?: string | null;
  currency?: string | null;
  paymentStatus?: string | null;
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

  // ✅ modal state
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  // ✅ checkout certification form
  const [checkOutForm, setCheckOutForm] = useState({
    outstandingAmount: "0.00", // receptionist can adjust
    damagesCost: "0.00",
    damagesNotes: "",
    certifyNoOutstanding: false,
    certifyNoDamages: false,
    notes: "",
  });

  const count = useMemo(() => bookings.length, [bookings]);

  async function loadInHouse(search = "") {
    setError("");
    setLoading(true);
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const data = await apiFetch(`/api/bookings/inhouse${qs}`);
      setBookings((data?.bookings ?? []) as Booking[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load in-house guests");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  function openCheckOutModal(b: Booking) {
    setActiveBooking(b);

    // Prefill amounts if available; otherwise default 0.00
    const total = b.totalAmount ? String(b.totalAmount) : "0.00";

    setCheckOutForm({
      outstandingAmount: "0.00", // if you later compute balance, prefill here
      damagesCost: "0.00",
      damagesNotes: "",
      certifyNoOutstanding: false,
      certifyNoDamages: false,
      notes: "",
    });

    setCheckOutOpen(true);
  }

  function toMoneyString(input: string) {
    const cleaned = input.replace(/[^0-9.]/g, "");
    const [a, b] = cleaned.split(".");
    const normalized = b !== undefined ? `${a}.${b.slice(0, 2)}` : a;
    return normalized;
  }

  const canSubmitCheckout =
    checkOutForm.certifyNoOutstanding && checkOutForm.certifyNoDamages;

  async function submitCheckOut() {
    if (!activeBooking) return;

    if (!canSubmitCheckout) {
      setError("Please certify guest has no outstanding payment and no damages before checkout.");
      return;
    }

    setError("");
    setBusyId(activeBooking.id);

    try {
      await apiFetch(`/api/bookings/${activeBooking.id}/check-out`, {
        method: "POST",
        body: JSON.stringify({
          notes: checkOutForm.notes || null,
          outstandingAmount: checkOutForm.outstandingAmount || "0.00",
          damagesCost: checkOutForm.damagesCost || "0.00",
          damagesNotes: checkOutForm.damagesNotes || null,
          certifyNoOutstanding: true,
          certifyNoDamages: true,
        }),
      });

      setCheckOutOpen(false);
      setActiveBooking(null);

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
          <p className="text-muted-foreground mt-2">Search in-house guests and complete check-out.</p>
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
              <p className="font-semibold text-red-700">Something went wrong</p>
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
                              <span className="text-xs text-muted-foreground">({b.unit.type})</span>
                            ) : null}
                          </p>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                          <span>
                            Checked-in at:{" "}
                            <span className="font-medium text-slate-700">
                              {b.checkedInAt ? new Date(b.checkedInAt).toLocaleString() : "n/a"}
                            </span>
                          </span>

                          {b.guestPhone ? (
                            <span>
                              Phone: <span className="font-medium text-slate-700">{b.guestPhone}</span>
                            </span>
                          ) : null}

                          {b.guestEmail ? (
                            <span>
                              Email: <span className="font-medium text-slate-700">{b.guestEmail}</span>
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
                      <Button onClick={() => openCheckOutModal(b)} disabled={isBusy}>
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

                      <Button variant="outline" onClick={() => navigator.clipboard.writeText(b.id)}>
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

      {/* CHECK-OUT CERTIFICATION MODAL */}
      <Dialog open={checkOutOpen} onOpenChange={setCheckOutOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Checkout Certification
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold">
                {activeBooking?.guestName || "Guest"}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  • {activeBooking?.unit?.property?.name ? `${activeBooking?.unit?.property?.name} — ` : ""}
                  {activeBooking?.unit?.name ?? ""}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You must confirm guest has no outstanding payment and no damages before checkout.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Outstanding Amount (₦)</Label>
                <Input
                  inputMode="decimal"
                  value={checkOutForm.outstandingAmount}
                  onChange={(e) =>
                    setCheckOutForm((p) => ({ ...p, outstandingAmount: toMoneyString(e.target.value) }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">Set to 0.00 if fully settled.</p>
              </div>

              <div className="space-y-2">
                <Label>Damages Cost (₦)</Label>
                <Input
                  inputMode="decimal"
                  value={checkOutForm.damagesCost}
                  onChange={(e) =>
                    setCheckOutForm((p) => ({ ...p, damagesCost: toMoneyString(e.target.value) }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">Set to 0.00 if no damages.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Damages Notes (optional)</Label>
              <Input
                value={checkOutForm.damagesNotes}
                onChange={(e) => setCheckOutForm((p) => ({ ...p, damagesNotes: e.target.value }))}
                placeholder="Describe any damages (if any)..."
              />
            </div>

            <div className="space-y-2">
              <Label>Checkout Notes (optional)</Label>
              <Input
                value={checkOutForm.notes}
                onChange={(e) => setCheckOutForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Any note for housekeeping/front desk..."
              />
            </div>

            {/* certifications */}
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checkOutForm.certifyNoOutstanding}
                  onChange={(e) => setCheckOutForm((p) => ({ ...p, certifyNoOutstanding: e.target.checked }))}
                />
                <span>
                  I certify the guest has <b>no outstanding payment</b> (Outstanding Amount is 0.00).
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checkOutForm.certifyNoDamages}
                  onChange={(e) => setCheckOutForm((p) => ({ ...p, certifyNoDamages: e.target.checked }))}
                />
                <span>
                  I certify the room/unit has <b>no damages or missing items</b> (Damages Cost is 0.00).
                </span>
              </label>
            </div>

            <Button
              onClick={submitCheckOut}
              className="w-full"
              disabled={!activeBooking || busyId === activeBooking?.id || !canSubmitCheckout}
            >
              {busyId === activeBooking?.id ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Checking out…
                </>
              ) : (
                <>
                  <DoorClosed className="mr-2 h-4 w-4" />
                  Confirm Check-out
                </>
              )}
            </Button>

            {!canSubmitCheckout ? (
              <p className="text-xs text-amber-700">
                Please tick both certifications before you can check-out.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
