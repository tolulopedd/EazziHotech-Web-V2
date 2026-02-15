// src/pages/CheckOutPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle,
  Clipboard,
  DoorClosed,
  RefreshCcw,
  Search,
  Users,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

type Booking = {
  id: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  guest?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
  checkedInAt?: string | null;
  totalAmount?: string | null;
  currency?: string | null;
  paymentStatus?: string | null;
  totalBill?: string | null;
  paidTotal?: string | null;
  outstandingAmount?: string | null;

  guestPhotoUrl?: string | null;

  unit?: {
    name: string;
    type: "ROOM" | "APARTMENT";
    property?: { name: string };
  };
};

function getErrorMessage(e: unknown, fallback: string) {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function extractApiCode(err: unknown) {
  if (!err || typeof err !== "object") return "";
  const e = err as {
    code?: unknown;
    data?: { code?: unknown; error?: { code?: unknown }; err?: { code?: unknown } };
  };
  const code = e.code ?? e.data?.code ?? e.data?.error?.code ?? e.data?.err?.code;
  return typeof code === "string" ? code : "";
}

export default function CheckOutPage() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ✅ modal state
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [checkOutError, setCheckOutError] = useState("");
  const [damageChargeNote, setDamageChargeNote] = useState("");

  // ✅ checkout certification form
  const [checkOutForm, setCheckOutForm] = useState({
    outstandingAmount: "0.00",
    damagesCost: "0.00",
    damagesNotes: "",
    overstayAmount: "0.00",
    overstayNotes: "",
    refundPolicy: "NO_REFUND",
    partialPenalty: "0.00",
    refundApproved: false,
    refundAmount: "0.00",
    refundReason: "",
    certifyNoOutstanding: false,
    certifyNoDamages: false,
    notes: "",
  });

  const count = useMemo(() => bookings.length, [bookings]);

  function displayGuestName(b: Booking) {
    return b.guest?.fullName?.trim() || b.guestName?.trim() || "Guest";
  }

  function displayGuestPhone(b: Booking) {
    return b.guest?.phone?.trim() || b.guestPhone?.trim() || "";
  }

  function displayGuestEmail(b: Booking) {
    return b.guest?.email?.trim() || b.guestEmail?.trim() || "";
  }

  async function loadInHouse(search = "") {
    setError("");
    setLoading(true);
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const data = await apiFetch(`/api/bookings/inhouse${qs}`);
      setBookings((data?.bookings ?? []) as Booking[]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load in-house guests"));
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  function openCheckOutModal(b: Booking) {
    setActiveBooking(b);
    setCheckOutError("");
    setDamageChargeNote("");
    const outstandingFromServer = String(b.outstandingAmount ?? "0.00");

    const now = Date.now();
    const checkoutAt = b.checkOut ? new Date(b.checkOut).getTime() : 0;
    const isEarly = checkoutAt > 0 && checkoutAt > now;
    const bookedNights = b.checkIn && b.checkOut
      ? Math.max(1, Math.ceil((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const usedNights = b.checkIn
      ? Math.max(1, Math.min(bookedNights, Math.ceil((now - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24))))
      : 1;
    const unusedNights = Math.max(0, bookedNights - usedNights);
    const baseAmount = Number(b.totalAmount ?? "0");
    const nightlyRate = bookedNights > 0 ? baseAmount / bookedNights : 0;
    const eligible = isEarly ? Math.max(0, unusedNights * nightlyRate) : 0;

    const overstayDays = b.checkOut
      ? Math.max(0, Math.floor((Date.now() - new Date(b.checkOut).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const suggestedOverstayAmount = overstayDays > 0 ? Math.max(0, nightlyRate * overstayDays) : 0;

    setCheckOutForm({
      outstandingAmount: toMoneyString(outstandingFromServer),
      damagesCost: "0.00",
      damagesNotes: "",
      overstayAmount: suggestedOverstayAmount > 0 ? suggestedOverstayAmount.toFixed(2) : "0.00",
      overstayNotes: "",
      refundPolicy: isEarly ? "PARTIAL" : "NO_REFUND",
      partialPenalty: "0.00",
      refundApproved: false,
      refundAmount: eligible.toFixed(2),
      refundReason: "",
      certifyNoOutstanding: false,
      certifyNoDamages: false,
      notes: "",
    });

    setCheckOutOpen(true);
    setError("");
  }

  function toMoneyString(input: string) {
    const cleaned = input.replace(/[^0-9.]/g, "");
    const [a, b] = cleaned.split(".");
    return b !== undefined ? `${a}.${b.slice(0, 2)}` : a;
  }

  const canSubmitCheckout = checkOutForm.certifyNoOutstanding && checkOutForm.certifyNoDamages;
  const outstandingNum = Number(checkOutForm.outstandingAmount || "0");
  const damagesNum = Number(checkOutForm.damagesCost || "0");
  const hasOutstanding = Number.isFinite(outstandingNum) && outstandingNum > 0.009;
  const hasDamages = Number.isFinite(damagesNum) && damagesNum > 0.009;
  const projectedOutstanding = Math.max(
    0,
    (Number.isFinite(outstandingNum) ? outstandingNum : 0) + (Number.isFinite(damagesNum) ? damagesNum : 0)
  );
  const canAddDamageCharge = Boolean(activeBooking) && damagesNum > 0.009 && busyId !== activeBooking?.id;
  const overstayNum = Number(checkOutForm.overstayAmount || "0");
  const hasOverstayAmount = Number.isFinite(overstayNum) && overstayNum > 0.009;
  const canAddOverstayCharge =
    Boolean(activeBooking) && isOverstayedBooking(activeBooking) && hasOverstayAmount && busyId !== activeBooking?.id;
  const scheduledCheckOutMs = activeBooking?.checkOut ? new Date(activeBooking.checkOut).getTime() : 0;
  const isEarlyCheckout = Boolean(scheduledCheckOutMs && scheduledCheckOutMs > Date.now());
  const bookedNights = activeBooking?.checkIn && activeBooking?.checkOut
    ? Math.max(
        1,
        Math.ceil(
          (new Date(activeBooking.checkOut).getTime() - new Date(activeBooking.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 1;
  const usedNights = activeBooking?.checkIn
    ? Math.max(1, Math.min(bookedNights, Math.ceil((Date.now() - new Date(activeBooking.checkIn).getTime()) / (1000 * 60 * 60 * 24))))
    : 1;
  const unusedNights = Math.max(0, bookedNights - usedNights);
  const baseBookingAmount = Number(activeBooking?.totalAmount ?? "0");
  const nightlyRate = bookedNights > 0 ? baseBookingAmount / bookedNights : 0;
  const refundEligible = isEarlyCheckout ? Math.max(0, unusedNights * nightlyRate) : 0;
  const partialPenaltyNum = Number(checkOutForm.partialPenalty || "0");
  const safePenalty = Number.isFinite(partialPenaltyNum) ? Math.max(0, partialPenaltyNum) : 0;
  const suggestedRefund =
    checkOutForm.refundPolicy === "NO_REFUND"
      ? 0
      : checkOutForm.refundPolicy === "PARTIAL"
      ? Math.max(0, refundEligible - safePenalty)
      : refundEligible;
  const refundAmountNum = Number(checkOutForm.refundAmount || "0");
  const safeRefundAmount = Number.isFinite(refundAmountNum) ? Math.max(0, refundAmountNum) : 0;

  function toFixedMoney(n: number) {
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  }

  async function submitCheckOut() {
    if (!activeBooking) return;

    if (!canSubmitCheckout) {
      setCheckOutError("Please certify guest has no outstanding payment and no damages before checkout.");
      return;
    }

    setError("");
    setCheckOutError("");
    setDamageChargeNote("");
    setBusyId(activeBooking.id);

    try {
      await apiFetch(`/api/bookings/${activeBooking.id}/check-out`, {
        method: "POST",
        body: JSON.stringify({
          notes: checkOutForm.notes || null,
          outstandingAmount: checkOutForm.outstandingAmount || "0.00",
          damagesCost: checkOutForm.damagesCost || "0.00",
          damagesNotes: checkOutForm.damagesNotes || null,
          refundPolicy: isEarlyCheckout ? checkOutForm.refundPolicy : "NO_REFUND",
          refundApproved: Boolean(isEarlyCheckout && checkOutForm.refundApproved),
          refundAmount: isEarlyCheckout && checkOutForm.refundApproved ? safeRefundAmount.toFixed(2) : "0.00",
          refundReason: isEarlyCheckout ? (checkOutForm.refundReason || null) : null,
          certifyNoOutstanding: true,
          certifyNoDamages: true,
        }),
      });

      toast.success("Checked out successfully");

      setCheckOutOpen(false);
      setActiveBooking(null);

      await loadInHouse(q);
    } catch (e: unknown) {
      const code = extractApiCode(e);
      const status = e && typeof e === "object" && "status" in e ? (e as { status?: unknown }).status : undefined;

      // ✅ NEW: handle backend checkout lock
      if (status === 409 && code === "OUTSTANDING_BALANCE") {
        const msg = getErrorMessage(e, "Outstanding balance must be settled before checkout.");
        toast.error(msg);
        setCheckOutError(msg);
        if (damagesNum > 0) {
          setDamageChargeNote(`Damage charge added: ₦${damagesNum.toFixed(2)}. Please settle outstanding to complete checkout.`);
        }
        return;
      }

      setCheckOutError(getErrorMessage(e, "Check-out failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function addDamageChargeOnly() {
    if (!activeBooking) return;
    if (!(damagesNum > 0.009)) {
      setCheckOutError("Enter a damages cost greater than 0.00 to add a damage charge.");
      return;
    }

    setCheckOutError("");
    setDamageChargeNote("");
    setBusyId(activeBooking.id);

    try {
      await apiFetch(`/api/bookings/${activeBooking.id}/check-out`, {
        method: "POST",
        body: JSON.stringify({
          notes: checkOutForm.notes || null,
          outstandingAmount: checkOutForm.outstandingAmount || "0.00",
          damagesCost: checkOutForm.damagesCost || "0.00",
          damagesNotes: checkOutForm.damagesNotes || null,
        }),
      });
      // Defensive: should generally not happen when damages > 0 and unpaid.
      toast.success("Damage charge added.");
    } catch (e: unknown) {
      const code = extractApiCode(e);
      const status = e && typeof e === "object" && "status" in e ? (e as { status?: unknown }).status : undefined;
      if (status === 409 && code === "OUTSTANDING_BALANCE") {
        const msg = getErrorMessage(e, "Damage charge added. Outstanding balance must be settled before checkout.");
        toast.success("Damage charge added");
        setCheckOutError("");
        setDamageChargeNote(msg);
        setCheckOutForm((p) => ({
          ...p,
          outstandingAmount: toFixedMoney(projectedOutstanding),
          damagesCost: "0.00",
          certifyNoDamages: false,
          certifyNoOutstanding: false,
        }));
        await loadInHouse(q);
        return;
      }
      setCheckOutError(getErrorMessage(e, "Failed to add damage charge."));
    } finally {
      setBusyId(null);
    }
  }

  function isOverstayedBooking(b: Booking | null) {
    if (!b?.checkOut) return false;
    return new Date(b.checkOut).getTime() < Date.now();
  }

  function getOverstayDays(b: Booking | null) {
    if (!b?.checkOut) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(b.checkOut).getTime()) / (1000 * 60 * 60 * 24)));
  }

  async function addOverstayChargeOnly() {
    if (!activeBooking) return;
    if (!isOverstayedBooking(activeBooking)) {
      setCheckOutError("Overstay charge can be added only after scheduled checkout date.");
      return;
    }
    if (!hasOverstayAmount) {
      setCheckOutError("Enter an overstay amount greater than 0.00.");
      return;
    }

    setCheckOutError("");
    setDamageChargeNote("");
    setBusyId(activeBooking.id);

    try {
      await apiFetch(`/api/bookings/${activeBooking.id}/overstay-charge`, {
        method: "POST",
        body: JSON.stringify({
          amount: checkOutForm.overstayAmount || "0.00",
          notes: checkOutForm.overstayNotes || null,
        }),
      });
      toast.success("Overstay charge added");
      setCheckOutForm((p) => ({
        ...p,
        outstandingAmount: toFixedMoney((Number(p.outstandingAmount || "0") || 0) + (Number(p.overstayAmount || "0") || 0)),
        overstayAmount: "0.00",
        overstayNotes: "",
        certifyNoOutstanding: false,
      }));
      await loadInHouse(q);
    } catch (e: unknown) {
      setCheckOutError(getErrorMessage(e, "Failed to add overstay charge."));
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

          <Button
            variant="outline"
            onClick={() => nav("/app/payments")}
            className="hidden md:inline-flex"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Payments
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
                const guestName = displayGuestName(b);
                const guestPhone = displayGuestPhone(b);
                const guestEmail = displayGuestEmail(b);

                const isBusy = busyId === b.id;
                const overstayed = isOverstayedBooking(b);
                const overstayDays = getOverstayDays(b);

                return (
                  <div
                    key={b.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold truncate">{guestName}</p>
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

                          {guestPhone ? (
                            <span>
                              Phone: <span className="font-medium text-slate-700">{guestPhone}</span>
                            </span>
                          ) : null}

                          {guestEmail ? (
                            <span>
                              Email: <span className="font-medium text-slate-700">{guestEmail}</span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium">
                            Status: <span className="ml-1 font-semibold">{b.status}</span>
                          </span>
                          {overstayed ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                              OVERSTAYED • {overstayDays} day{overstayDays === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
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
      <Dialog
        open={checkOutOpen}
        onOpenChange={(open: boolean) => {
          setCheckOutOpen(open);
          if (!open) {
            setCheckOutError("");
            setDamageChargeNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Checkout Certification
            </DialogTitle>
            <DialogDescription>
              Review payment and room condition details before confirming checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto pr-1 max-h-[calc(90vh-120px)]">
            {checkOutError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">{checkOutError}</p>
              </div>
            ) : null}

            {damageChargeNote ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-700">{damageChargeNote}</p>
              </div>
            ) : null}

            {/* show guest photo */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-3">
                <div className="h-36 w-34 rounded-lg border bg-white overflow-hidden flex items-center justify-center shrink-0">
                  {activeBooking?.guestPhotoUrl ? (
                    <img
                      src={activeBooking.guestPhotoUrl}
                      alt="Guest"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No photo</span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {(activeBooking ? displayGuestName(activeBooking) : "Guest")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      • {activeBooking?.unit?.property?.name ? `${activeBooking?.unit?.property?.name} — ` : ""}
                      {activeBooking?.unit?.name ?? ""}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please confirm this is the correct guest before completing check-out.
                  </p>

                  {/* ✅ Quick link to settle payment if blocked */}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setCheckOutOpen(false);
                      setActiveBooking(null);
                      nav("/app/payments");
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Settle Payment (Outstanding)
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Outstanding Amount (₦)</Label>
                <Input
                  inputMode="decimal"
                  value={checkOutForm.outstandingAmount}
                  readOnly
                  disabled
                />
                <p className="text-[11px] text-muted-foreground">Auto-calculated from open charges and payments.</p>
              </div>

              <div className="space-y-2">
                <Label>Damages Cost (₦)</Label>
                <Input
                  inputMode="decimal"
                  value={checkOutForm.damagesCost}
                  onChange={(e) => {
                    const nextDamages = toMoneyString(e.target.value);
                    const nextDamagesNum = Number(nextDamages || "0");
                    setCheckOutForm((p) => ({
                      ...p,
                      damagesCost: nextDamages,
                      certifyNoDamages: Number.isFinite(nextDamagesNum) ? nextDamagesNum <= 0.009 && p.certifyNoDamages : false,
                    }));
                  }}
                />
                <p className="text-[11px] text-muted-foreground">Set to 0.00 if no damages.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Projected outstanding after damages: <span className="font-semibold">₦{projectedOutstanding.toFixed(2)}</span>
            </p>

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

            {activeBooking && isOverstayedBooking(activeBooking) ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                <p className="text-sm font-semibold text-amber-800">
                  Overstay detected: {getOverstayDays(activeBooking)} day
                  {getOverstayDays(activeBooking) === 1 ? "" : "s"} past scheduled checkout
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Overstay Charge (₦)</Label>
                    <Input
                      inputMode="decimal"
                      value={checkOutForm.overstayAmount}
                      onChange={(e) => setCheckOutForm((p) => ({ ...p, overstayAmount: toMoneyString(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Overstay Notes (optional)</Label>
                    <Input
                      value={checkOutForm.overstayNotes}
                      onChange={(e) => setCheckOutForm((p) => ({ ...p, overstayNotes: e.target.value }))}
                      placeholder="Reason / period / approval..."
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addOverstayChargeOnly}
                  className="w-full"
                  disabled={!canAddOverstayCharge}
                >
                  {busyId === activeBooking?.id ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      Adding overstay charge…
                    </>
                  ) : (
                    "Add Overstay Charge"
                  )}
                </Button>
              </div>
            ) : null}

            {isEarlyCheckout ? (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-3">
                <p className="text-sm font-semibold text-indigo-800">Early Checkout Policy</p>
                <p className="text-xs text-indigo-700">
                  Scheduled checkout is in the future. Apply policy and decide refund manually.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Booked Nights</p>
                    <p className="text-sm font-medium">{bookedNights}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Used Nights</p>
                    <p className="text-sm font-medium">{usedNights}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Unused Nights</p>
                    <p className="text-sm font-medium">{unusedNights}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Nightly Rate</p>
                    <p className="text-sm font-medium">₦{nightlyRate.toFixed(2)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Refund Policy</Label>
                  <select
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-background"
                    value={checkOutForm.refundPolicy}
                    onChange={(e) =>
                      setCheckOutForm((p) => ({
                        ...p,
                        refundPolicy: e.target.value,
                        refundAmount:
                          e.target.value === "NO_REFUND"
                            ? "0.00"
                            : e.target.value === "PARTIAL"
                            ? Math.max(0, refundEligible - safePenalty).toFixed(2)
                            : refundEligible.toFixed(2),
                      }))
                    }
                  >
                    <option value="NO_REFUND">No refund</option>
                    <option value="PARTIAL">Partial refund</option>
                    <option value="FLEXIBLE">Flexible refund</option>
                  </select>
                </div>

                {checkOutForm.refundPolicy === "PARTIAL" ? (
                  <div className="space-y-2">
                    <Label>Penalty / Admin Fee (₦)</Label>
                    <Input
                      inputMode="decimal"
                      value={checkOutForm.partialPenalty}
                      onChange={(e) =>
                        setCheckOutForm((p) => ({
                          ...p,
                          partialPenalty: toMoneyString(e.target.value),
                          refundAmount: Math.max(0, refundEligible - Number(toMoneyString(e.target.value) || "0")).toFixed(2),
                        }))
                      }
                    />
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Eligible refund: <span className="font-semibold">₦{refundEligible.toFixed(2)}</span> • Suggested:
                  <span className="font-semibold"> ₦{suggestedRefund.toFixed(2)}</span>
                </p>

                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={checkOutForm.refundApproved}
                    onChange={(e) =>
                      setCheckOutForm((p) => ({
                        ...p,
                        refundApproved: e.target.checked,
                        refundAmount: e.target.checked ? suggestedRefund.toFixed(2) : "0.00",
                      }))
                    }
                  />
                  <span>I approve refund for this early checkout</span>
                </label>

                {checkOutForm.refundApproved ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Refund Amount (₦)</Label>
                      <Input
                        inputMode="decimal"
                        value={checkOutForm.refundAmount}
                        onChange={(e) => setCheckOutForm((p) => ({ ...p, refundAmount: toMoneyString(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Refund Reason</Label>
                      <Input
                        value={checkOutForm.refundReason}
                        onChange={(e) => setCheckOutForm((p) => ({ ...p, refundReason: e.target.value }))}
                        placeholder="Reason for refund..."
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* certifications */}
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checkOutForm.certifyNoOutstanding}
                  disabled={hasOutstanding}
                  onChange={(e) => setCheckOutForm((p) => ({ ...p, certifyNoOutstanding: e.target.checked }))}
                />
                <span>
                  I certify the guest has <b>no outstanding payment</b> (Outstanding Amount is 0.00).
                  {hasOutstanding ? (
                    <span className="block text-xs text-amber-700 mt-1">
                      Outstanding amount must be 0.00 before this can be certified.
                    </span>
                  ) : null}
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={checkOutForm.certifyNoDamages}
                  disabled={hasDamages}
                  onChange={(e) => setCheckOutForm((p) => ({ ...p, certifyNoDamages: e.target.checked }))}
                />
                <span>
                  I certify the room/unit has <b>no damages or missing items</b> (Damages Cost is 0.00).
                  {hasDamages ? (
                    <span className="block text-xs text-amber-700 mt-1">
                      Damages cost must be 0.00 before this can be certified.
                    </span>
                  ) : null}
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

            <Button
              type="button"
              variant="outline"
              onClick={addDamageChargeOnly}
              className="w-full"
              disabled={!canAddDamageCharge}
            >
              {busyId === activeBooking?.id ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Adding damage charge…
                </>
              ) : (
                "Add Damage Charge"
              )}
            </Button>

            {!canSubmitCheckout ? (
              <p className="text-xs text-amber-700">Please tick both certifications before you can check-out.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
