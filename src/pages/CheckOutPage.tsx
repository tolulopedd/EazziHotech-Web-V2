// src/pages/CheckOutPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch, getAccessToken, getTenantId } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatNaira } from "@/lib/currency";
import { formatDateLagos, formatDateTimeLagos, formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Clipboard,
  CalendarPlus2,
  DoorClosed,
  RefreshCcw,
  Search,
  Users,
  ShieldCheck,
  CreditCard,
  Download,
} from "lucide-react";

type Booking = {
  id: string;
  unitId?: string;
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
  charges?: Array<{
    id: string;
    title: string;
    type: "ROOM" | "DAMAGE" | "EXTRA" | "PENALTY" | "DISCOUNT";
    amount: string;
    currency?: string;
    createdAt: string;
  }>;

  guestPhotoUrl?: string | null;

  unit?: {
    id?: string;
    name: string;
    type: "ROOM" | "APARTMENT";
    property?: { name: string };
  };
};

type BookingVisitor = {
  id: string;
  bookingId: string;
  fullName: string;
  phone?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  purpose?: string | null;
  isOvernight: boolean;
  checkInAt: string;
  checkOutAt?: string | null;
  notes?: string | null;
};

type BillPreview = {
  generatedAt: string;
  booking: {
    id: string;
    reference: string;
    status: string;
    paymentStatus: string;
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    propertyName: string;
    propertyAddress: string;
    unitName: string;
    unitType: string;
    checkIn: string;
    checkOut: string;
    currency: string;
    baseAmount: string;
  };
  charges: Array<{
    id: string;
    type: string;
    typeLabel: string;
    title: string;
    amount: string;
    currency: string;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    currency: string;
    method: string;
    paidAt: string;
    reference: string;
  }>;
  summary: {
    totalBill: string;
    paidTotal: string;
    balanceDue: string;
    currency: string;
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

function chargeTypeLabel(charge: { type: string; title?: string | null }) {
  const type = String(charge.type || "").toUpperCase();
  if (type === "ROOM") return "Room";
  if (type === "DAMAGE") return "Damage";
  if (type === "PENALTY") return "Penalty";
  if (type === "DISCOUNT") return "Discount";
  if (type !== "EXTRA") return charge.type;

  const title = String(charge.title || "").trim();
  const lower = title.toLowerCase();

  if (lower.includes("restaurant")) return "Restaurant";
  if (lower.includes("laundry")) return "Laundry";
  if (lower.includes("bar")) return "Bar";
  if (lower.includes("overstay")) return "Overstay";
  if (lower.includes("stay extension")) return "Stay Extension";

  const prefix = title.split(":")[0]?.trim().toUpperCase();
  if (["RESTAURANT", "LAUNDRY", "BAR", "OTHER"].includes(prefix)) {
    return prefix.charAt(0) + prefix.slice(1).toLowerCase();
  }
  return "Extra";
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function CheckOutPage() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ✅ modal state
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [visitorBooking, setVisitorBooking] = useState<Booking | null>(null);
  const [checkOutError, setCheckOutError] = useState("");
  const [damageChargeNote, setDamageChargeNote] = useState("");
  const [serviceChargeNote, setServiceChargeNote] = useState("");
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [visitors, setVisitors] = useState<BookingVisitor[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [visitorsError, setVisitorsError] = useState("");
  const [visitorBusyId, setVisitorBusyId] = useState<string | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState("");
  const [billData, setBillData] = useState<BillPreview | null>(null);
  const [billExporting, setBillExporting] = useState<"CSV" | "XLSX" | "PDF" | null>(null);
  const [billSending, setBillSending] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendBooking, setExtendBooking] = useState<Booking | null>(null);
  const [extendError, setExtendError] = useState("");
  const [extendForm, setExtendForm] = useState({
    newCheckOut: "",
    notes: "",
  });
  const [extendBlockedRanges, setExtendBlockedRanges] = useState<Array<{ from: Date; to: Date }>>([]);
  const [visitorForm, setVisitorForm] = useState({
    fullName: "",
    phone: "",
    purpose: "",
    isOvernight: false,
    notes: "",
  });

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
  const [serviceChargeForm, setServiceChargeForm] = useState({
    category: "RESTAURANT",
    title: "",
    amount: "",
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

  async function refreshActiveBooking() {
    if (!activeBooking) return;
    const qs = q.trim() ? `?search=${encodeURIComponent(q.trim())}` : "";
    const data = await apiFetch(`/api/bookings/inhouse${qs}`);
    const rows = (data?.bookings ?? []) as Booking[];
    setBookings(rows);
    const latest = rows.find((x) => x.id === activeBooking.id);
    if (latest) {
      setActiveBooking(latest);
      setCheckOutForm((p) => ({
        ...p,
        outstandingAmount: toFixedMoney(Number(latest.outstandingAmount || "0") || 0),
        certifyNoOutstanding: false,
      }));
    }
  }

  async function openBillPreview(b: Booking) {
    setBillOpen(true);
    setBillLoading(true);
    setBillError("");
    setBillData(null);
    try {
      const data = await apiFetch(`/api/bookings/${b.id}/bill`);
      setBillData((data?.bill ?? null) as BillPreview | null);
    } catch (e: unknown) {
      setBillError(getErrorMessage(e, "Failed to load bill preview"));
    } finally {
      setBillLoading(false);
    }
  }

  async function downloadBillFile(bookingId: string, kind: "CSV" | "XLSX" | "PDF") {
    const endpoint = kind === "CSV" ? "bill.csv" : kind === "XLSX" ? "bill.xlsx" : "bill.pdf";
    setBillExporting(kind);
    setBillError("");
    try {
      const headers = new Headers();
      const tenantId = getTenantId();
      const token = getAccessToken();
      if (tenantId) headers.set("x-tenant-id", tenantId);
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/${endpoint}`, {
        method: "GET",
        headers,
      });
      if (!res.ok) {
        const txt = await res.text();
        let msg = "Failed to export bill";
        try {
          const parsed = txt ? JSON.parse(txt) : null;
          msg = parsed?.error?.message || parsed?.message || msg;
        } catch {
          // ignore parse errors
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bill_${bookingId.slice(-8)}.${kind === "CSV" ? "csv" : kind === "XLSX" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setBillError(getErrorMessage(e, "Failed to export bill"));
    } finally {
      setBillExporting(null);
    }
  }

  async function sendBillToGuest(bookingId: string) {
    setBillSending(true);
    setBillError("");
    try {
      await apiFetch(`/api/bookings/${bookingId}/bill/send`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Bill sent to guest email");
    } catch (e: unknown) {
      setBillError(getErrorMessage(e, "Failed to send bill email"));
    } finally {
      setBillSending(false);
    }
  }

  function openCheckOutModal(b: Booking) {
    setActiveBooking(b);
    setCheckOutError("");
    setDamageChargeNote("");
    setServiceChargeNote("");
    setPhotoLoadFailed(false);
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
    setServiceChargeForm({
      category: "RESTAURANT",
      title: "",
      amount: "",
      notes: "",
    });

    setCheckOutOpen(true);
    setError("");
  }

  function openVisitorModal(b: Booking) {
    setVisitorBooking(b);
    setVisitors([]);
    setVisitorsError("");
    setVisitorBusyId(null);
    setVisitorForm({
      fullName: "",
      phone: "",
      purpose: "",
      isOvernight: false,
      notes: "",
    });
    setVisitorOpen(true);
    void loadVisitors(b.id);
  }

  function dateInputValue(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  async function openExtendModal(b: Booking) {
    const current = b.checkOut ? new Date(b.checkOut) : new Date();
    const suggested = new Date(current);
    suggested.setDate(suggested.getDate() + 1);
    setExtendBooking(b);
    setExtendError("");
    setExtendForm({
      newCheckOut: dateInputValue(suggested.toISOString()),
      notes: "",
    });
    setExtendBlockedRanges([]);
    const unitId = b.unit?.id || b.unitId;
    if (unitId) {
      try {
        const data = await apiFetch(`/api/bookings?unitId=${encodeURIComponent(unitId)}&activeOnly=1&limit=500`);
        const rows = (data?.bookings ?? []) as Array<{ id: string; checkIn?: string; checkOut?: string }>;
        const ranges = rows
          .filter((x) => x.id !== b.id && x.checkIn && x.checkOut)
          .map((x) => ({
            from: new Date(String(x.checkIn)),
            to: new Date(String(x.checkOut)),
          }))
          .filter((x) => !Number.isNaN(x.from.getTime()) && !Number.isNaN(x.to.getTime()));
        setExtendBlockedRanges(ranges);
      } catch {
        // keep backend as source of truth; UI fallback still validates on submit.
        setExtendBlockedRanges([]);
      }
    }
    setExtendOpen(true);
  }

  function toMidnight(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function isDateBlockedForExtension(date: Date) {
    if (!extendBooking?.checkOut) return false;
    const day = toMidnight(date).getTime();
    const today = toMidnight(new Date()).getTime();
    const currentCheckoutDay = toMidnight(new Date(extendBooking.checkOut)).getTime();

    // past days and current/earlier checkout day are not valid extension targets
    if (day <= today) return true;
    if (day <= currentCheckoutDay) return true;

    // disable dates falling inside existing active bookings on same unit
    return extendBlockedRanges.some((r) => {
      const from = toMidnight(r.from).getTime();
      // booking checkOut is exclusive; date strictly before checkout day is blocked
      const toExclusive = toMidnight(r.to).getTime();
      return day >= from && day < toExclusive;
    });
  }

  async function submitExtendStay() {
    if (!extendBooking) return;
    if (!extendForm.newCheckOut) {
      setExtendError("Select a new check-out date.");
      return;
    }

    const nextCheckout = new Date(`${extendForm.newCheckOut}T12:00:00.000Z`);
    if (Number.isNaN(nextCheckout.getTime())) {
      setExtendError("Invalid date selected.");
      return;
    }
    if (extendBooking.checkOut && nextCheckout <= new Date(extendBooking.checkOut)) {
      setExtendError("New check-out date must be after current check-out.");
      return;
    }

    setExtendBusy(true);
    setExtendError("");
    try {
      const data = await apiFetch(`/api/bookings/${extendBooking.id}/extend-stay`, {
        method: "POST",
        body: JSON.stringify({
          newCheckOut: nextCheckout.toISOString(),
          notes: extendForm.notes || null,
        }),
      });

      const amount = Number(data?.extension?.extensionAmount ?? 0);
      toast.success(
        `Stay extended successfully${amount > 0 ? ` (${formatNaira(amount)} added)` : ""}`
      );
      setExtendOpen(false);
      setExtendBooking(null);
      await loadInHouse(q);
    } catch (e: unknown) {
      setExtendError(getErrorMessage(e, "Failed to extend stay"));
    } finally {
      setExtendBusy(false);
    }
  }

  async function loadVisitors(bookingId: string) {
    setVisitorsError("");
    setVisitorsLoading(true);
    try {
      const data = await apiFetch(`/api/bookings/${bookingId}/visitors`);
      setVisitors((data?.visitors ?? []) as BookingVisitor[]);
    } catch (e: unknown) {
      setVisitors([]);
      setVisitorsError(getErrorMessage(e, "Failed to load visitor log"));
    } finally {
      setVisitorsLoading(false);
    }
  }

  async function addVisitor() {
    if (!visitorBooking) return;
    const name = visitorForm.fullName.trim();
    if (!name) {
      setVisitorsError("Visitor name is required.");
      return;
    }

    setVisitorBusyId("CREATE");
    setVisitorsError("");
    try {
      await apiFetch(`/api/bookings/${visitorBooking.id}/visitors`, {
        method: "POST",
        body: JSON.stringify({
          fullName: name,
          phone: visitorForm.phone || null,
          purpose: visitorForm.purpose || null,
          isOvernight: visitorForm.isOvernight,
          notes: visitorForm.notes || null,
        }),
      });
      toast.success("Visitor logged");
      setVisitorForm({
        fullName: "",
        phone: "",
        purpose: "",
        isOvernight: false,
        notes: "",
      });
      await loadVisitors(visitorBooking.id);
    } catch (e: unknown) {
      setVisitorsError(getErrorMessage(e, "Failed to log visitor"));
    } finally {
      setVisitorBusyId(null);
    }
  }

  async function markVisitorLeft(visitorId: string) {
    if (!visitorBooking) return;
    setVisitorBusyId(visitorId);
    setVisitorsError("");
    try {
      await apiFetch(`/api/bookings/${visitorBooking.id}/visitors/${visitorId}/checkout`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      toast.success("Visitor marked as left");
      await loadVisitors(visitorBooking.id);
    } catch (e: unknown) {
      setVisitorsError(getErrorMessage(e, "Failed to update visitor"));
    } finally {
      setVisitorBusyId(null);
    }
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
  const serviceAmountNum = Number(serviceChargeForm.amount || "0");
  const canAddServiceCharge =
    Boolean(activeBooking) &&
    Number.isFinite(serviceAmountNum) &&
    serviceAmountNum > 0.009 &&
    busyId !== activeBooking?.id;
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
    setServiceChargeNote("");
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
          setDamageChargeNote(`Damage charge added: ${formatNaira(damagesNum)}. Please settle outstanding to complete checkout.`);
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
    setServiceChargeNote("");
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

  async function addServiceChargeOnly() {
    if (!activeBooking) return;
    if (!canAddServiceCharge) {
      setCheckOutError("Enter a service charge amount greater than 0.00.");
      return;
    }

    setCheckOutError("");
    setServiceChargeNote("");
    setBusyId(activeBooking.id);

    try {
      await apiFetch(`/api/bookings/${activeBooking.id}/service-charge`, {
        method: "POST",
        body: JSON.stringify({
          category: serviceChargeForm.category,
          title: serviceChargeForm.title || null,
          amount: serviceChargeForm.amount || "0.00",
          notes: serviceChargeForm.notes || null,
        }),
      });

      toast.success("Service charge added");
      setServiceChargeForm({
        category: serviceChargeForm.category,
        title: "",
        amount: "",
        notes: "",
      });
      setServiceChargeNote("Service charge added. Please settle outstanding to complete checkout.");
      await refreshActiveBooking();
    } catch (e: unknown) {
      setCheckOutError(getErrorMessage(e, "Failed to add service charge."));
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
    setServiceChargeNote("");
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
            In-house: <span className="font-semibold text-indigo-700">{formatInteger(count)}</span>
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
                              {b.checkedInAt ? formatDateTimeLagos(b.checkedInAt) : "n/a"}
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
                              OVERSTAYED • {formatInteger(overstayDays)} day{overstayDays === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => openVisitorModal(b)}>
                        <Users className="mr-2 h-4 w-4" />
                        Log Visitor
                      </Button>

                      <Button variant="outline" onClick={() => openExtendModal(b)} disabled={isBusy}>
                        <CalendarPlus2 className="mr-2 h-4 w-4" />
                        Extend Stay
                      </Button>

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

            {serviceChargeNote ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-700">{serviceChargeNote}</p>
              </div>
            ) : null}

            {/* show guest photo */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-3">
                <div className="h-36 w-34 rounded-lg border bg-white overflow-hidden flex items-center justify-center shrink-0">
                  {activeBooking?.guestPhotoUrl && !photoLoadFailed ? (
                    <img
                      src={activeBooking.guestPhotoUrl}
                      alt="Guest"
                      className="h-full w-full object-cover"
                      onError={() => setPhotoLoadFailed(true)}
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {activeBooking?.guestPhotoUrl ? "Photo unavailable" : "No photo"}
                    </span>
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

                  {activeBooking ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2"
                      onClick={() => openBillPreview(activeBooking)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Preview / Export Bill
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-sm font-semibold">Current Bill Details</p>
              {activeBooking?.charges && activeBooking.charges.length > 0 ? (
                <div className="space-y-2">
                  {activeBooking.charges.map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {chargeTypeLabel(c)} • {formatDateTimeLagos(c.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold shrink-0">{formatNaira(Number(c.amount || "0"))}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No itemized charges yet. Room charge may still apply in total.</p>
              )}
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-3">
              <p className="text-sm font-semibold text-indigo-800">Add In-Stay Service Charge</p>
              <p className="text-xs text-indigo-700">
                Use this for restaurant, laundry, bar, or other guest consumptions before checkout.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-background"
                    value={serviceChargeForm.category}
                    onChange={(e) => setServiceChargeForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="LAUNDRY">Laundry</option>
                    <option value="BAR">Bar</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (₦)</Label>
                  <Input
                    inputMode="decimal"
                    value={serviceChargeForm.amount}
                    onChange={(e) => setServiceChargeForm((p) => ({ ...p, amount: toMoneyString(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={serviceChargeForm.title}
                    onChange={(e) => setServiceChargeForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Dinner, Laundry batch"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={serviceChargeForm.notes}
                    onChange={(e) => setServiceChargeForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Any billing detail..."
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addServiceChargeOnly}
                className="w-full"
                disabled={!canAddServiceCharge}
              >
                {busyId === activeBooking?.id ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Adding service charge…
                  </>
                ) : (
                  "Add Service Charge"
                )}
              </Button>
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
              Projected outstanding after damages: <span className="font-semibold">{formatNaira(projectedOutstanding)}</span>
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
                  Overstay detected: {formatInteger(getOverstayDays(activeBooking))} day
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
                    <p className="text-sm font-medium">{formatNaira(nightlyRate)}</p>
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
                  Eligible refund: <span className="font-semibold">{formatNaira(refundEligible)}</span> • Suggested:
                  <span className="font-semibold"> {formatNaira(suggestedRefund)}</span>
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

      <Dialog
        open={billOpen}
        onOpenChange={(open: boolean) => {
          setBillOpen(open);
          if (!open) {
            setBillLoading(false);
            setBillExporting(null);
            setBillError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Bill Preview</DialogTitle>
            <DialogDescription>
              Review bill details and export as pdf to print or send to Guest email before completing checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1 max-h-[calc(90vh-120px)]">
            {billError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">{billError}</p>
              </div>
            ) : null}

            {billLoading ? (
              <div className="rounded-lg border border-slate-200 p-4 text-sm text-muted-foreground">
                Loading bill preview...
              </div>
            ) : billData ? (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">{billData.booking.guestName || "Guest"}</p>
                  <p className="text-muted-foreground mt-1">
                    Ref: #{billData.booking.reference} • {billData.booking.propertyName} — {billData.booking.unitName}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Stay: {formatDateTimeLagos(billData.booking.checkIn)} to {formatDateTimeLagos(billData.booking.checkOut)}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Guest Email: {billData.booking.guestEmail || "Not maintained"}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <p className="text-sm font-semibold">Bill Lines</p>
                  {billData.charges.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No open bill lines found.</p>
                  ) : (
                    <div className="space-y-2">
                      {billData.charges.map((c) => (
                        <div key={c.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.title || c.typeLabel}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {c.typeLabel} • {formatDateTimeLagos(c.createdAt)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold shrink-0">{formatNaira(Number(c.amount || "0"))}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Bill</p>
                    <p className="text-sm font-semibold">{formatNaira(Number(billData.summary.totalBill || "0"))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="text-sm font-semibold">{formatNaira(Number(billData.summary.paidTotal || "0"))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Balance Due</p>
                    <p className="text-sm font-semibold">{formatNaira(Number(billData.summary.balanceDue || "0"))}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadBillFile(billData.booking.id, "PDF")}
                    disabled={billExporting !== null}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {billExporting === "PDF" ? "Exporting PDF..." : "Export PDF"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => sendBillToGuest(billData.booking.id)}
                    disabled={billSending || billExporting !== null || !billData.booking.guestEmail}
                  >
                    {billSending ? "Sending..." : "Send Bill to Guest Email"}
                  </Button>
                </div>
                {!billData.booking.guestEmail ? (
                  <p className="text-xs text-amber-700">
                    Guest email is not maintained for this booking. Update guest email before sending bill.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-slate-200 p-4 text-sm text-muted-foreground">
                Open a booking bill to preview.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* STAY EXTENSION MODAL */}
      <Dialog
        open={extendOpen}
        onOpenChange={(open: boolean) => {
          setExtendOpen(open);
          if (!open) {
            setExtendError("");
            setExtendBusy(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus2 className="h-5 w-5 text-indigo-600" />
              Extend Stay
            </DialogTitle>
            <DialogDescription>
              Extend an in-house guest stay. Extension is allowed only if future dates are available.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {extendBooking ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">{displayGuestName(extendBooking)}</p>
                <p className="text-muted-foreground mt-1">
                  Current check-out:{" "}
                  <span className="font-medium text-slate-800">
                    {extendBooking.checkOut ? formatDateTimeLagos(extendBooking.checkOut) : "n/a"}
                  </span>
                </p>
              </div>
            ) : null}

            {extendError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">{extendError}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>New check-out date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !extendForm.newCheckOut && "text-muted-foreground")}
                  >
                    {extendForm.newCheckOut ? formatDateLagos(extendForm.newCheckOut) : "Select new check-out date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={extendForm.newCheckOut ? new Date(`${extendForm.newCheckOut}T12:00:00`) : undefined}
                    onSelect={(d) => {
                      if (!d) return;
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      setExtendForm((p) => ({ ...p, newCheckOut: `${yyyy}-${mm}-${dd}` }));
                    }}
                    disabled={isDateBlockedForExtension}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Past dates and already-booked dates are disabled.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={extendForm.notes}
                onChange={(e) => setExtendForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Reason for extension..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExtendOpen(false)} disabled={extendBusy}>
                Cancel
              </Button>
              <Button onClick={submitExtendStay} disabled={extendBusy}>
                {extendBusy ? "Extending..." : "Confirm Extension"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={visitorOpen}
        onOpenChange={(open: boolean) => {
          setVisitorOpen(open);
          if (!open) {
            setVisitorBooking(null);
            setVisitors([]);
            setVisitorsError("");
            setVisitorBusyId(null);
            setVisitorForm({
              fullName: "",
              phone: "",
              purpose: "",
              isOvernight: false,
              notes: "",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Visitor Log
            </DialogTitle>
            <DialogDescription>
              Record visitors for {visitorBooking ? displayGuestName(visitorBooking) : "selected guest"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1 max-h-[calc(90vh-120px)]">
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Visitor</p>
                <p className="text-xs text-muted-foreground">
                  Open visitors:{" "}
                  <span className="font-semibold">
                    {formatInteger(visitors.filter((v) => !v.checkOutAt).length)}
                  </span>
                </p>
              </div>

              {visitorsError ? (
                <p className="text-xs text-red-700">{visitorsError}</p>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Visitor Name</Label>
                  <Input
                    value={visitorForm.fullName}
                    onChange={(e) => setVisitorForm((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Enter visitor name"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone (optional)</Label>
                  <Input
                    value={visitorForm.phone}
                    onChange={(e) => setVisitorForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="080..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Purpose (optional)</Label>
                  <Input
                    value={visitorForm.purpose}
                    onChange={(e) => setVisitorForm((p) => ({ ...p, purpose: e.target.value }))}
                    placeholder="Visit, delivery, maintenance..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={visitorForm.notes}
                    onChange={(e) => setVisitorForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Extra details..."
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={visitorForm.isOvernight}
                  onChange={(e) => setVisitorForm((p) => ({ ...p, isOvernight: e.target.checked }))}
                />
                Staying with guest (overnight)
              </label>

              <Button
                type="button"
                variant="outline"
                onClick={addVisitor}
                disabled={visitorBusyId === "CREATE" || !visitorBooking}
              >
                {visitorBusyId === "CREATE" ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Logging visitor...
                  </>
                ) : (
                  "Log Visitor"
                )}
              </Button>
            </div>

            <div className="rounded-md border border-slate-200">
              {visitorsLoading ? (
                <div className="p-3 text-xs text-muted-foreground">Loading visitor log...</div>
              ) : visitors.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">No visitors logged for this stay yet.</div>
              ) : (
                <div className="divide-y">
                  {visitors.map((v) => {
                    const isOpen = !v.checkOutAt;
                    return (
                      <div key={v.id} className="p-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{v.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              In: {formatDateTimeLagos(v.checkInAt)}
                              {v.checkOutAt ? ` • Out: ${formatDateTimeLagos(v.checkOutAt)}` : " • Still in"}
                            </p>
                            {(v.phone || v.purpose || v.notes) ? (
                              <p className="text-xs text-muted-foreground truncate">
                                {[v.phone, v.purpose, v.notes].filter(Boolean).join(" • ")}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {v.isOvernight ? (
                              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                OVERNIGHT
                              </span>
                            ) : null}
                            {isOpen ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => markVisitorLeft(v.id)}
                                disabled={visitorBusyId === v.id}
                              >
                                {visitorBusyId === v.id ? "Updating..." : "Mark Left"}
                              </Button>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                LEFT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
