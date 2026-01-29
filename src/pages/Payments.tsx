// src/pages/Payments.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Search } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type PaymentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | string;

type Payment = {
  id: string;
  tenantId: string;
  bookingId: string;

  method: string; // MANUAL
  status: PaymentStatus;

  amount: string; // Decimal string
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
  if (s === "PARTIALLY_PAID") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (s === "UNPAID") return "bg-slate-100 text-slate-800 border-slate-200";
  if (s === "REJECTED") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
}

export default function Payments() {
  const [tab, setTab] = useState<"PENDING" | "CONFIRMED">("PENDING");
  const [loading, setLoading] = useState(true);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [query, setQuery] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function fetchPayments() {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.set("status", tab);
      const data = await apiFetch(`/api/payments?${qs.toString()}`);
      setPayments(data.payments || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
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
      return (
        ref.includes(q) ||
        bid.includes(q) ||
        pid.includes(q) ||
        guest.includes(q) ||
        email.includes(q) ||
        unit.includes(q) ||
        amt.includes(q)
      );
    });
  }, [payments, query]);

  function openConfirm(p: Payment) {
    setSelected(p);
    setConfirmOpen(true);
  }

  async function doConfirm() {
    if (!selected) return;

    try {
      setConfirming(true);
      await apiFetch(`/api/payments/${selected.id}/confirm`, { method: "POST" });
      toast.success("Payment confirmed");

      setConfirmOpen(false);
      setSelected(null);

      // Optimistic update: remove from pending
      if (tab === "PENDING") {
        setPayments((prev) => prev.filter((x) => x.id !== selected.id));
      } else {
        fetchPayments();
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to confirm payment");
    } finally {
      setConfirming(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-2">
            Confirm cash / bank transfer payments. Confirming updates booking payment status automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchPayments}>
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
            className={cn(
              "px-4 py-2 font-medium border-b-2 transition",
              tab === "PENDING"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-slate-900"
            )}
          >
            Pending
          </button>
          <button
            onClick={() => setTab("CONFIRMED")}
            className={cn(
              "px-4 py-2 font-medium border-b-2 transition",
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
            placeholder="Search by reference, guest, unit, booking/payment ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {tab === "PENDING" ? "No pending payments to confirm." : "No confirmed payments found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
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

                    {tab === "PENDING" ? (
                      <Button variant="outline" onClick={() => openConfirm(p)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {formatMoney(selected.amount, selected.currency)}
                    <span className="text-muted-foreground"> • {selected.method}</span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Ref: {selected.reference || "—"}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Booking: <span className="font-mono text-xs">{selected.bookingId}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Confirm action</Label>
                <p className="text-sm text-muted-foreground">
                  This will mark the payment as <span className="font-medium">CONFIRMED</span> and automatically update the
                  booking payment status to <span className="font-medium">PARTIALLY_PAID</span> or <span className="font-medium">PAID</span>.
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={confirming}>
                  Cancel
                </Button>
                <Button onClick={doConfirm} disabled={confirming}>
                  {confirming ? "Confirming..." : "Confirm Payment"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No payment selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
