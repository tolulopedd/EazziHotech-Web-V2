// src/pages/Payments.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Search, CreditCard } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type PaymentStatus = "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED" | string;

type Payment = {
  id: string;
  tenantId: string;
  bookingId: string;

  method: string;
  status: PaymentStatus;

  amount: string;
  currency: string;
  reference: string | null;
  notes: string | null;

  paidAt: string | null;
  confirmedAt: string | null;
  confirmedByUserId: string | null;

  createdAt: string;
  updatedAt: string;

  booking?: {
    id: string;
    unitId: string;
    status: string;
    paymentStatus: string;
    checkIn: string;
    checkOut: string;
    guestName: string | null;
    guestEmail: string | null;
    totalAmount: string | null;
    currency: string;
    unit?: { id: string; name: string } | null;
  };
};

type PendingItem = {
  bookingId: string;
  guestName: string | null;
  unitName?: string | null;
  bookingStatus: string;
  paymentStatus: string; // UNPAID | PARTPAID (from BookingPaymentStatus)
  totalAmount: string; // "45000.00"
  paidTotal: string;   // "25000.00"
  outstanding: string; // "20000.00"
  currency: string;    // "NGN"
};

type CollectField = "amount" | "reference";
type CollectErrors = Partial<Record<CollectField, string>>;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const [day, mon, year] = d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .split(" ");
  return `${day}-${mon}-${year}`;
}

function formatMoney(amount?: string | null, currency?: string | null) {
  const a = amount ? Number(amount) : NaN;
  if (Number.isNaN(a)) return `${currency || "NGN"} ${amount || "—"}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(a);
  } catch {
    return `${currency || "NGN"} ${a.toFixed(2)}`;
  }
}

function pillClass(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "CONFIRMED") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "PAID") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "PARTPAID" || s === "PARTIALLY_PAID") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (s === "UNPAID") return "bg-slate-100 text-slate-800 border-slate-200";
  if (s === "FAILED" || s === "REJECTED") return "bg-rose-100 text-rose-800 border-rose-200";
  if (s === "REFUNDED") return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function toMoneyString(input: string) {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const [a, b] = cleaned.split(".");
  return b !== undefined ? `${a}.${b.slice(0, 2)}` : a;
}

function toNumberSafe(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function getErrorMessage(e: unknown, fallback: string) {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

export default function Payments() {
  const [tab, setTab] = useState<"PENDING" | "CONFIRMED">("PENDING");
  const [loading, setLoading] = useState(true);

  // CONFIRMED tab data
  const [payments, setPayments] = useState<Payment[]>([]);

  // PENDING tab data (outstanding balances)
  const [pending, setPending] = useState<PendingItem[]>([]);

  const [query, setQuery] = useState("");

  // Collect payment dialog
  const [collectOpen, setCollectOpen] = useState(false);
  const [selectedPending, setSelectedPending] = useState<PendingItem | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collectSubmitAttempted, setCollectSubmitAttempted] = useState(false);
  const [collectTouched, setCollectTouched] = useState<Record<CollectField, boolean>>({
    amount: false,
    reference: false,
  });
  const [collectForm, setCollectForm] = useState({
    amount: "",
    currency: "NGN",
    reference: "",
    notes: "",
  });

  const selectedOutstandingNum = useMemo(() => {
    if (!selectedPending) return NaN;
    return toNumberSafe(String(selectedPending.outstanding ?? ""));
  }, [selectedPending]);

  const collectErrors = useMemo<CollectErrors>(() => {
    const next: CollectErrors = {};
    const amt = toMoneyString(collectForm.amount);
    const amtNum = toNumberSafe(amt);
    const ref = collectForm.reference.trim();

    if (!amt || !Number.isFinite(amtNum) || amtNum <= 0) {
      next.amount = "Enter a valid amount greater than 0.";
    } else if (Number.isFinite(selectedOutstandingNum) && amtNum > selectedOutstandingNum + 0.009) {
      next.amount = "Amount cannot exceed outstanding balance.";
    }

    if (!ref) {
      next.reference = "Reference is required.";
    }

    return next;
  }, [collectForm.amount, collectForm.reference, selectedOutstandingNum]);

  const isCollectFormValid = Object.keys(collectErrors).length === 0;
  const showCollectError = (field: CollectField) =>
    Boolean(collectErrors[field]) && (collectSubmitAttempted || collectTouched[field]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function fetchData() {
    try {
      setLoading(true);

      if (tab === "CONFIRMED") {
        const qs = new URLSearchParams();
        qs.set("status", "CONFIRMED");
        const data = await apiFetch(`/api/payments?${qs.toString()}`);
        setPayments(data.payments || []);
      } else {
        const data = await apiFetch(`/api/payments/pending`);
        setPending(data.items || []);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to load payments"));
    } finally {
      setLoading(false);
    }
  }

  const filteredPending = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pending;

    return pending.filter((x) => {
      const guest = (x.guestName || "").toLowerCase();
      const unit = (x.unitName || "").toLowerCase();
      const bid = (x.bookingId || "").toLowerCase();
      const amt = `${x.totalAmount} ${x.paidTotal} ${x.outstanding}`.toLowerCase();
      return guest.includes(q) || unit.includes(q) || bid.includes(q) || amt.includes(q);
    });
  }, [pending, query]);

  const filteredConfirmed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;

    return payments.filter((p) => {
      const ref = (p.reference || "").toLowerCase();
      const bid = (p.bookingId || "").toLowerCase();
      const pid = (p.id || "").toLowerCase();
      const guest = (p.booking?.guestName || "").toLowerCase();
      const email = (p.booking?.guestEmail || "").toLowerCase();
      const unit = (p.booking?.unit?.name || "").toLowerCase();
      const amt = String(p.amount || "").toLowerCase();
      return ref.includes(q) || bid.includes(q) || pid.includes(q) || guest.includes(q) || email.includes(q) || unit.includes(q) || amt.includes(q);
    });
  }, [payments, query]);

  function openCollect(item: PendingItem) {
    setSelectedPending(item);
    setCollectSubmitAttempted(false);
    setCollectTouched({ amount: false, reference: false });
    setCollectForm({
      amount: item.outstanding || "",
      currency: item.currency || "NGN",
      reference: "",
      notes: "",
    });
    setCollectOpen(true);
  }

  async function doCollect() {
    if (!selectedPending) return;
    setCollectSubmitAttempted(true);
    if (!isCollectFormValid) {
      toast.error("Please resolve payment form errors.");
      return;
    }
    const amt = toMoneyString(collectForm.amount);

    try {
      setCollecting(true);

      await apiFetch(`/api/bookings/${selectedPending.bookingId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          currency: collectForm.currency,
          reference: collectForm.reference.trim(),
          notes: collectForm.notes || null,
        }),
      });

      toast.success("Payment recorded");

      setCollectOpen(false);
      setSelectedPending(null);

      // refresh the active tab data
      await fetchData();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to record payment"));
    } finally {
      setCollecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  const list = tab === "PENDING" ? filteredPending : filteredConfirmed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-2">
            Pending = bookings with balance due. Confirmed = all confirmed payment records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab("PENDING")}
            disabled={loading}
            className={cn(
              "px-4 py-2 font-medium border-b-2 transition disabled:opacity-50",
              tab === "PENDING"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-slate-900"
            )}
          >
            Pending (Balance Due)
          </button>
          <button
            onClick={() => setTab("CONFIRMED")}
            disabled={loading}
            className={cn(
              "px-4 py-2 font-medium border-b-2 transition disabled:opacity-50",
              tab === "CONFIRMED"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-slate-900"
            )}
          >
            Confirmed
          </button>
        </div>

        <div className="relative w-full md:max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by guest, unit, booking/payment ID, amount..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {query.trim()
                ? "No payment records match your search."
                : tab === "PENDING"
                ? "No balances due."
                : "No confirmed payments found."}
            </p>
          </CardContent>
        </Card>
      ) : tab === "PENDING" ? (
        <div className="space-y-3">
          {filteredPending.map((x) => (
            <Card key={x.bookingId} className="border-slate-200">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      Balance Due: {formatMoney(x.outstanding, x.currency)}
                    </CardTitle>

                    <p className="text-sm text-muted-foreground mt-1">
                      Booking: <span className="font-mono text-xs">{x.bookingId}</span>
                    </p>

                    <p className="text-sm text-muted-foreground mt-1">
                      {x.guestName || "Guest"} • {x.unitName || "—"}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", pillClass(x.paymentStatus))}>
                        Booking Payment: {x.paymentStatus}
                      </span>
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", pillClass(x.bookingStatus))}>
                        Booking Status: {x.bookingStatus}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200">
                        Total: {formatMoney(x.totalAmount, x.currency)}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200">
                        Paid: {formatMoney(x.paidTotal, x.currency)}
                      </span>
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => openCollect(x)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Collect
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConfirmed.map((p) => {
            const unitName = p.booking?.unit?.name || p.booking?.unitId || "—";
            const guest = p.booking?.guestName || "Guest";
            const guestEmail = p.booking?.guestEmail ? `(${p.booking.guestEmail})` : "";

            return (
              <Card key={p.id} className="border-slate-200">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {formatMoney(p.amount, p.currency)}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">• {p.method}</span>
                      </CardTitle>

                      <p className="text-sm text-muted-foreground mt-1">
                        Ref: {p.reference || "—"} • Payment ID: <span className="font-mono text-xs">{p.id}</span>
                      </p>

                      <p className="text-sm text-muted-foreground mt-1">
                        Booking: <span className="font-mono text-xs">{p.bookingId}</span> • Unit: {unitName} • {guest}{" "}
                        <span className="text-sm font-normal text-muted-foreground">{guestEmail}</span>
                      </p>

                      {p.booking ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", pillClass(p.status))}>
                            Payment: {p.status}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium border",
                              pillClass(p.booking.paymentStatus)
                            )}
                          >
                            Booking Payment: {p.booking.paymentStatus}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200">
                            Stay: {formatDate(p.booking.checkIn)} → {formatDate(p.booking.checkOut)}
                          </span>
                          {p.booking.totalAmount ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200">
                              Total: {formatMoney(p.booking.totalAmount, p.booking.currency)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Collect dialog */}
      <Dialog
        open={collectOpen}
        onOpenChange={(open) => {
          setCollectOpen(open);
          if (!open) {
            setCollectSubmitAttempted(false);
            setCollectTouched({ amount: false, reference: false });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>
              Record received payment for this booking. Amount must not exceed balance due.
            </DialogDescription>
          </DialogHeader>

          {selectedPending ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm">
                  <div className="font-medium">
                    Balance Due: {formatMoney(selectedPending.outstanding, selectedPending.currency)}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Total: {formatMoney(selectedPending.totalAmount, selectedPending.currency)} • Paid:{" "}
                    {formatMoney(selectedPending.paidTotal, selectedPending.currency)}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Booking: <span className="font-mono text-xs">{selectedPending.bookingId}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  inputMode="decimal"
                  value={collectForm.amount}
                  onChange={(e) => {
                    setCollectTouched((s) => ({ ...s, amount: true }));
                    setCollectForm((s) => ({ ...s, amount: toMoneyString(e.target.value) }));
                  }}
                />
                {showCollectError("amount") ? (
                  <p className="text-xs text-red-600">{collectErrors.amount}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={collectForm.reference}
                  onChange={(e) => {
                    setCollectTouched((s) => ({ ...s, reference: true }));
                    setCollectForm((s) => ({ ...s, reference: e.target.value }));
                  }}
                  placeholder="Cash / Transfer Ref..."
                />
                {showCollectError("reference") ? (
                  <p className="text-xs text-red-600">{collectErrors.reference}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>
                  Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  value={collectForm.notes}
                  onChange={(e) => setCollectForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Any note..."
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCollectOpen(false)} disabled={collecting}>
                  Cancel
                </Button>
                <Button onClick={doCollect} disabled={collecting || !isCollectFormValid}>
                  {collecting ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No booking selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
