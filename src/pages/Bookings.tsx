// src/pages/Bookings.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Plus, CreditCard, RefreshCw, Search, UserPlus, X } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { apiFetch } from "@/lib/api";
import { formatNaira } from "@/lib/currency";
import { formatDateLagos } from "@/lib/format";

/* ================= TYPES ================= */

interface Property {
  id: string;
  name: string;
  type: string;
}

interface Unit {
  id: string;
  propertyId: string;
  name: string;
  type: string;
  capacity: number;
  basePrice: string; // "45000.00"
  discountType?: "PERCENT" | "FIXED_PRICE" | null;
  discountValue?: string | null;
  discountStart?: string | null;
  discountEnd?: string | null;
  discountLabel?: string | null;
}

type Guest = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
};

type PreBooking = {
  id: string;
  guestId?: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guest?: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  plannedCheckIn?: string | null;
  plannedCheckOut?: string | null;
  amountPaid: string;
  currency?: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "CONVERTED";
  createdAt: string;
};

interface Booking {
  id: string;
  unitId: string;

  status: string;
  paymentStatus: string;

  checkIn: string;
  checkOut: string;

  guestName: string | null;
  guestEmail: string | null;

  // ✅ NEW (if backend includes it)
  guestId?: string | null;
  guest?: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;

  totalAmount?: string | number | null;
  currency?: string;
  totalBill?: string;
  paidTotal?: string;
  outstandingAmount?: string;

  createdAt: string;
}

type Role = "ADMIN" | "MANAGER" | "STAFF";

type BookingFormField = "property" | "unit" | "dates" | "guest" | "preBooking" | "total";
type BookingFormErrors = Partial<Record<BookingFormField, string>>;

function formatMaybeNGN(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatNaira(n);
}

/* ================= HELPERS ================= */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LAGOS_TZ = "Africa/Lagos";
const BOOKING_BACKDATE_DAYS_ALLOWED = 1;
const lagosDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: LAGOS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function lagosDateKey(input: Date | string) {
  const d = input instanceof Date ? input : new Date(input);
  return lagosDateFmt.format(d);
}

function dayNumberFromDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / MS_PER_DAY);
}

function lagosDayNumber(input: Date | string) {
  return dayNumberFromDateKey(lagosDateKey(input));
}

function diffNights(from: Date, to: Date) {
  return Math.max(0, lagosDayNumber(to) - lagosDayNumber(from));
}

function unitRateForDate(unit: Unit, day: Date) {
  const base = Number(unit.basePrice);
  if (!Number.isFinite(base) || base <= 0) return 0;

  if (!unit.discountType || !unit.discountValue || !unit.discountStart || !unit.discountEnd) {
    return base;
  }

  const dayN = lagosDayNumber(day);
  const startN = lagosDayNumber(new Date(unit.discountStart));
  const endN = lagosDayNumber(new Date(unit.discountEnd));
  if (dayN < startN || dayN > endN) return base;

  const v = Number(unit.discountValue);
  if (!Number.isFinite(v) || v <= 0) return base;

  if (unit.discountType === "PERCENT") {
    const pct = Math.max(0, Math.min(100, v));
    return Math.max(0, base * (1 - pct / 100));
  }
  if (unit.discountType === "FIXED_PRICE") {
    return Math.max(0, v);
  }
  return base;
}

function bookingTotalForUnit(unit: Unit, from: Date, to: Date) {
  const n = diffNights(from, to);
  if (n <= 0) return null;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    total += unitRateForDate(unit, d);
  }
  return money2(total);
}

function money2(n: number) {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function isUnpaid(status?: string | null) {
  return String(status || "").toUpperCase() === "UNPAID";
}

function isPartPaid(status?: string | null) {
  return String(status || "").toUpperCase() === "PARTPAID";
}

function canTakePayment(status?: string | null) {
  const s = String(status || "").toUpperCase();
  return s === "UNPAID" || s === "PARTPAID";
}

function toNoonISO(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
  return d.toISOString();
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return lagosDateKey(value);
}

function formatRange(r?: DateRange) {
  if (!r?.from) return "";
  if (!r.to) return formatDateLagos(r.from);
  return `${formatDateLagos(r.from)} → ${formatDateLagos(r.to)}`;
}

function formatDate(value?: string | null) {
  return formatDateLagos(value);
}

function toMoneyString(input: string) {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const [a, b] = cleaned.split(".");
  const normalized = b !== undefined ? `${a}.${b.slice(0, 2)}` : a;
  return normalized;
}

function toNumberSafe(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/* ================= COMPONENT ================= */

export default function Bookings() {
  const userRole = ((localStorage.getItem("userRole") || "staff").toUpperCase() as Role);
  const [calendarMonths, setCalendarMonths] = useState(2);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingsQuery, setBookingsQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);

  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showPreBookingDialog, setShowPreBookingDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [updatingBooking, setUpdatingBooking] = useState(false);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    checkIn: "",
    checkOut: "",
    totalAmount: "",
  });

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsByProperty, setUnitsByProperty] = useState<Record<string, Unit[]>>({});
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [bookingMode, setBookingMode] = useState<"NEW" | "PREBOOKING">("NEW");
  const [preBookings, setPreBookings] = useState<PreBooking[]>([]);
  const [selectedPreBookingId, setSelectedPreBookingId] = useState("");
  const [creatingPreBooking, setCreatingPreBooking] = useState(false);
  const [preBookingForm, setPreBookingForm] = useState({
    plannedCheckIn: "",
    plannedCheckOut: "",
    amountPaid: "",
    notes: "",
  });
  const [preGuestQuery, setPreGuestQuery] = useState("");
  const [preGuestResults, setPreGuestResults] = useState<Guest[]>([]);
  const [preGuestSearching, setPreGuestSearching] = useState(false);
  const [selectedPreGuest, setSelectedPreGuest] = useState<Guest | null>(null);
  const preGuestSearchTimer = useRef<number | null>(null);
  const [showPreNewGuest, setShowPreNewGuest] = useState(false);
  const [preNewGuestForm, setPreNewGuestForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
  });
  const [creatingPreGuest, setCreatingPreGuest] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>();
  const [unitBookings, setUnitBookings] = useState<Booking[]>([]);

  // ✅ Guest search + select
  const [guestQuery, setGuestQuery] = useState("");
  const [guestResults, setGuestResults] = useState<Guest[]>([]);
  const [guestSearching, setGuestSearching] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const guestSearchTimer = useRef<number | null>(null);

  // ✅ Create-new-guest dialog inside booking dialog
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuestForm, setNewGuestForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    idNumber: "",
  });

  const [editableTotal, setEditableTotal] = useState(""); // string decimal
  const [totalTouched, setTotalTouched] = useState(false);
  const [bookingSubmitAttempted, setBookingSubmitAttempted] = useState(false);
  const [bookingTouched, setBookingTouched] = useState<Record<BookingFormField, boolean>>({
    property: false,
    unit: false,
    dates: false,
    guest: false,
    preBooking: false,
    total: false,
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    currency: "NGN",
    reference: "",
    notes: "",
  });

  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  const [allowZeroPayment, setAllowZeroPayment] = useState(false);
  const lastPricingKeyRef = useRef<string>("");

  // Derived: selected unit, nights, totalAmount
  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedUnitId), [units, selectedUnitId]);
  const selectedPreBooking = useMemo(
    () => preBookings.find((p) => p.id === selectedPreBookingId) ?? null,
    [preBookings, selectedPreBookingId]
  );

  const nights = useMemo(() => {
    if (!range?.from || !range?.to) return 0;
    return diffNights(range.from, range.to);
  }, [range?.from, range?.to]);

  const totalAmount = useMemo(() => {
    if (!selectedUnit || !range?.from || !range?.to) return null;
    return bookingTotalForUnit(selectedUnit, range.from, range.to);
  }, [selectedUnit, range?.from, range?.to, nights]);

  const pricingKey = useMemo(() => {
    if (!selectedUnitId || !range?.from || !range?.to) return "";
    return `${selectedUnitId}|${lagosDayNumber(range.from)}|${lagosDayNumber(range.to)}`;
  }, [selectedUnitId, range?.from, range?.to]);

  const hasDateRangeOverlap = useMemo(() => {
    if (!range?.from || !range?.to) return false;
    const fromDay = lagosDayNumber(range.from);
    const toDay = lagosDayNumber(range.to);
    if (toDay <= fromDay) return true;
    return unitBookings.some((b) => {
      const s = lagosDayNumber(new Date(b.checkIn));
      const e = lagosDayNumber(new Date(b.checkOut));
      return fromDay < e && toDay > s;
    });
  }, [range?.from, range?.to, unitBookings]);

  const bookingErrors = useMemo<BookingFormErrors>(() => {
    const next: BookingFormErrors = {};

    if (!selectedPropertyId) next.property = "Select a property.";
    if (!selectedUnitId) next.unit = "Select a unit.";

    if (!range?.from || !range?.to) {
      next.dates = "Select both check-in and check-out dates.";
    } else if (nights <= 0) {
      next.dates = "Check-out must be at least one night after check-in.";
    } else if (hasDateRangeOverlap) {
      next.dates = "Selected dates conflict with an existing booking for this unit.";
    }

    if (bookingMode === "PREBOOKING") {
      if (!selectedPreBookingId) next.preBooking = "Select a pre-booking.";
    } else if (!selectedGuest?.id) {
      next.guest = "Select an existing guest or create a new one.";
    }

    const effectiveTotal = editableTotal || totalAmount || "";
    const totalNum = toNumberSafe(String(effectiveTotal));
    if (!totalAmount) {
      next.total = "Total cannot be calculated until unit and dates are selected.";
    } else if (!Number.isFinite(totalNum) || totalNum <= 0) {
      next.total = "Enter a valid total amount greater than 0.";
    }

    return next;
  }, [
    selectedPropertyId,
    selectedUnitId,
    range?.from,
    range?.to,
    nights,
    hasDateRangeOverlap,
    bookingMode,
    selectedPreBookingId,
    selectedGuest?.id,
    editableTotal,
    totalAmount,
  ]);

  const isBookingFormValid = Object.keys(bookingErrors).length === 0;

  const showFieldError = (field: BookingFormField) =>
    Boolean(bookingErrors[field]) && (bookingSubmitAttempted || bookingTouched[field]);

  /* ================= EFFECTS ================= */

  useEffect(() => {
    fetchBookings("", { append: false, cursor: null });
    fetchProperties();
    fetchPreBookings();
    void loadTenantPolicy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 767px)");
    const syncMonths = () => setCalendarMonths(media.matches ? 1 : 2);
    syncMonths();

    media.addEventListener("change", syncMonths);
    return () => media.removeEventListener("change", syncMonths);
  }, []);

  // ✅ Prefill payment ONCE when dialog opens
  useEffect(() => {
    if (!showPaymentDialog || !selectedBooking) return;
    const outstanding = Number(selectedBooking.outstandingAmount ?? "");
    const fallbackTotal = Number(selectedBooking.totalAmount ?? "");
    const defaultAmount = Number.isFinite(outstanding) && outstanding > 0
      ? money2(outstanding)
      : Number.isFinite(fallbackTotal) && fallbackTotal > 0
      ? money2(fallbackTotal)
      : "";

    setPaymentForm({
      amount: defaultAmount,
      currency: selectedBooking.currency || "NGN",
      reference: "",
      notes: "",
    });
  }, [showPaymentDialog, selectedBooking?.id]);

  // Debounced search for booking list
  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      fetchBookings(bookingsQuery, { append: false, cursor: null });
    }, 300);

    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingsQuery]);

  // Auto-fill editable total from computed total (unless user edited)
  useEffect(() => {
    if (!totalAmount) return;
    if (!totalTouched) setEditableTotal(String(totalAmount));
  }, [totalAmount, totalTouched]);

  // Keep booking amount aligned with computed unit/date pricing.
  // Manual override is only kept for the current exact unit+date selection.
  useEffect(() => {
    if (!pricingKey) {
      lastPricingKeyRef.current = "";
      return;
    }
    if (lastPricingKeyRef.current !== pricingKey) {
      lastPricingKeyRef.current = pricingKey;
      setTotalTouched(false);
      if (totalAmount) setEditableTotal(String(totalAmount));
    }
  }, [pricingKey, totalAmount]);

  // ✅ Guest search with debounce
  useEffect(() => {
    const q = guestQuery.trim();
    if (!showBookingDialog) return;

    if (guestSearchTimer.current) window.clearTimeout(guestSearchTimer.current);

    if (!q) {
      setGuestResults([]);
      setGuestSearching(false);
      return;
    }

    guestSearchTimer.current = window.setTimeout(async () => {
      try {
        setGuestSearching(true);
        const data = await apiFetch(`/api/guests?q=${encodeURIComponent(q)}`);
        setGuestResults((data?.guests ?? data?.items ?? []) as Guest[]);
      } catch (e: any) {
        // do not block user—just empty results
        setGuestResults([]);
      } finally {
        setGuestSearching(false);
      }
    }, 250);

    return () => {
      if (guestSearchTimer.current) window.clearTimeout(guestSearchTimer.current);
    };
  }, [guestQuery, showBookingDialog]);

  // ✅ Pre-booking guest search with debounce
  useEffect(() => {
    const q = preGuestQuery.trim();
    if (!showPreBookingDialog) return;

    if (preGuestSearchTimer.current) window.clearTimeout(preGuestSearchTimer.current);

    if (!q) {
      setPreGuestResults([]);
      setPreGuestSearching(false);
      return;
    }

    preGuestSearchTimer.current = window.setTimeout(async () => {
      try {
        setPreGuestSearching(true);
        const data = await apiFetch(`/api/guests?q=${encodeURIComponent(q)}`);
        setPreGuestResults((data?.guests ?? data?.items ?? []) as Guest[]);
      } catch {
        setPreGuestResults([]);
      } finally {
        setPreGuestSearching(false);
      }
    }, 250);

    return () => {
      if (preGuestSearchTimer.current) window.clearTimeout(preGuestSearchTimer.current);
    };
  }, [preGuestQuery, showPreBookingDialog]);

  /* ================= API ================= */

  async function fetchBookings(
    search = bookingsQuery,
    options: { append?: boolean; cursor?: string | null } = {}
  ) {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      const q = search.trim();
      if (q) qs.set("q", q);
      qs.set("limit", "50");
      if (options.cursor) qs.set("cursor", options.cursor);
      const data = await apiFetch(`/api/bookings${qs.toString() ? `?${qs.toString()}` : ""}`);
      const list = (data.bookings || []) as Booking[];
      if (options.append) {
        setBookings((prev) => [...prev, ...list]);
      } else {
        setBookings(list);
      }
      setNextCursor(data?.pagination?.nextCursor ?? null);
      setHasMore(Boolean(data?.pagination?.hasMore));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load bookings");
      if (!options.append) setBookings([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProperties() {
    try {
      const data = await apiFetch("/api/properties");
      const propsList = (data.properties || []) as Property[];
      setProperties(propsList);

      hydrateUnitMapFromAllProperties(propsList);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load properties");
    }
  }

  async function fetchPreBookings() {
    try {
      const data = await apiFetch("/api/prebookings?limit=200");
      const rows = (data?.preBookings ?? []) as PreBooking[];
      setPreBookings(rows.filter((x) => x.status === "PENDING" || x.status === "PAID"));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load pre-bookings");
      setPreBookings([]);
    }
  }

  async function loadTenantPolicy() {
    try {
      const data = await apiFetch("/api/tenant");
      const minDeposit = Number(data?.settings?.minDepositPercent ?? 100);
      setAllowZeroPayment(Number.isFinite(minDeposit) && minDeposit === 0);
    } catch {
      setAllowZeroPayment(false);
    }
  }

  async function fetchUnits(propertyId: string) {
    try {
      setUnitsLoading(true);
      const data = await apiFetch(`/api/properties/${propertyId}/units`);
      const list = (data.units || []) as Unit[];
      setUnits(list);
      setUnitsByProperty((prev) => ({ ...prev, [propertyId]: list }));

      setUnitMap((prev) => {
        const next = { ...prev };
        for (const u of list) next[u.id] = u.name;
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load units");
      setUnits([]);
    } finally {
      setUnitsLoading(false);
    }
  }

  async function hydrateUnitMapFromAllProperties(propsList?: Property[]) {
    try {
      const list = propsList ?? properties;
      if (!list || list.length === 0) return;

      const results = await Promise.allSettled(list.map((p) => apiFetch(`/api/properties/${p.id}/units`)));

      const nextMap: Record<string, string> = {};
      const nextUnitsByProperty: Record<string, Unit[]> = {};
      for (const [index, r] of results.entries()) {
        const propertyId = list[index]?.id;
        if (!propertyId) continue;
        if (r.status === "fulfilled") {
          const units = (r.value?.units || []) as Unit[];
          nextUnitsByProperty[propertyId] = units;
          for (const u of units) nextMap[u.id] = u.name;
        } else if (!(propertyId in nextUnitsByProperty)) {
          nextUnitsByProperty[propertyId] = [];
        }
      }

      setUnitMap((prev) => ({ ...prev, ...nextMap }));
      setUnitsByProperty((prev) => ({ ...prev, ...nextUnitsByProperty }));
    } catch {
      // silent
    }
  }

  async function fetchBookingsForUnit(unitId: string) {
    try {
      const data = await apiFetch(
        `/api/bookings?unitId=${encodeURIComponent(unitId)}&activeOnly=1&limit=500`
      );
      const list: Booking[] = data.bookings || [];
      setUnitBookings(list);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load unit bookings");
      setUnitBookings([]);
    }
  }

  function isDateBooked(date: Date) {
    const t = lagosDayNumber(date);
    return unitBookings.some((b) => {
      const s = lagosDayNumber(new Date(b.checkIn));
      const e = lagosDayNumber(new Date(b.checkOut));
      return t >= s && t < e; // [checkIn, checkOut)
    });
  }

  async function createGuestAndSelect() {
    const fullName = newGuestForm.fullName.trim();
    const phone = newGuestForm.phone.trim();
    const email = newGuestForm.email.trim();
    const idNumber = newGuestForm.idNumber.trim();

    if (!fullName) {
      toast.error("Guest full name is required");
      return;
    }

    try {
      setCreatingGuest(true);
      const data = await apiFetch("/api/guests", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          phone: phone || null,
          email: email || null,
          idNumber: idNumber || null,
        }),
      });

      const g = (data?.guest ?? data) as Guest;
      if (!g?.id) throw new Error("Guest not created");

      setSelectedGuest(g);
      setBookingTouched((prev) => ({ ...prev, guest: true }));
      setGuestQuery(`${g.fullName}${g.phone ? ` • ${g.phone}` : ""}`);
      setGuestResults([]);
      setShowNewGuest(false);
      setNewGuestForm({ fullName: "", email: "", phone: "", idNumber: "" });

      toast.success("Guest created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create guest");
    } finally {
      setCreatingGuest(false);
    }
  }

  async function createPreGuestAndSelect() {
    const fullName = preNewGuestForm.fullName.trim();
    const phone = preNewGuestForm.phone.trim();
    const email = preNewGuestForm.email.trim();
    const idNumber = preNewGuestForm.idNumber.trim();

    if (!fullName) {
      toast.error("Guest full name is required");
      return;
    }

    try {
      setCreatingPreGuest(true);
      const data = await apiFetch("/api/guests", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          phone: phone || null,
          email: email || null,
          idNumber: idNumber || null,
        }),
      });

      const g = (data?.guest ?? data) as Guest;
      if (!g?.id) throw new Error("Guest not created");

      setSelectedPreGuest(g);
      setPreGuestQuery(`${g.fullName}${g.phone ? ` • ${g.phone}` : ""}`);
      setPreGuestResults([]);
      setShowPreNewGuest(false);
      setPreNewGuestForm({ fullName: "", email: "", phone: "", idNumber: "" });
      toast.success("Guest created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create guest");
    } finally {
      setCreatingPreGuest(false);
    }
  }

  async function handleCreatePreBooking() {
    if (creatingPreBooking) return;
    const amountPaid = toMoneyString(preBookingForm.amountPaid);
    if (!selectedPreGuest?.id) {
      toast.error("Select an existing guest or create a new guest.");
      return;
    }
    if (!preBookingForm.plannedCheckIn || !preBookingForm.plannedCheckOut) {
      toast.error("Planned check-in and check-out are required.");
      return;
    }
    const amountNum = toNumberSafe(amountPaid || "0");
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      toast.error("Amount paid must be 0 or greater.");
      return;
    }
    if (
      preBookingForm.plannedCheckIn &&
      preBookingForm.plannedCheckOut &&
      new Date(`${preBookingForm.plannedCheckOut}T12:00:00`).getTime() <=
        new Date(`${preBookingForm.plannedCheckIn}T12:00:00`).getTime()
    ) {
      toast.error("Planned check-out must be after planned check-in.");
      return;
    }

    try {
      setCreatingPreBooking(true);
      const data = await apiFetch("/api/prebookings", {
        method: "POST",
        body: JSON.stringify({
          guestId: selectedPreGuest.id,
          plannedCheckIn: `${preBookingForm.plannedCheckIn}T12:00:00.000Z`,
          plannedCheckOut: `${preBookingForm.plannedCheckOut}T12:00:00.000Z`,
          amountPaid: money2(amountNum),
          currency: "NGN",
          notes: preBookingForm.notes.trim() || null,
        }),
      });

      const created = data?.preBooking as PreBooking | undefined;
      if (!created?.id) throw new Error("Pre-booking was not created.");
      toast.success("Pre-booking created.");
      setShowPreBookingDialog(false);
      setPreBookingForm({
        plannedCheckIn: "",
        plannedCheckOut: "",
        amountPaid: "",
        notes: "",
      });
      setSelectedPreGuest(null);
      setPreGuestQuery("");
      setPreGuestResults([]);
      await fetchPreBookings();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create pre-booking.");
    } finally {
      setCreatingPreBooking(false);
    }
  }

  /* ================= CREATE BOOKING ================= */

async function handleCreateBooking() {
  if (creatingBooking) return;
  setBookingSubmitAttempted(true);
  if (!isBookingFormValid) {
    toast.error("Please resolve highlighted booking form errors.");
    return;
  }
  const checkInDate = range?.from;
  const checkOutDate = range?.to;
  const guestId = selectedGuest?.id;
  if (!checkInDate || !checkOutDate) return;
  if (bookingMode === "NEW" && !guestId) return;
  if (bookingMode === "PREBOOKING" && !selectedPreBookingId) return;

  const finalTotal = editableTotal ? money2(toNumberSafe(editableTotal)) : String(totalAmount ?? "");
  const finalNum = toNumberSafe(finalTotal);

  if (!Number.isFinite(finalNum) || finalNum <= 0) {
    toast.error("Total amount must be a valid number greater than 0.");
    return;
  }

  try {
    setCreatingBooking(true);
    if (bookingMode === "PREBOOKING") {
      await apiFetch(`/api/prebookings/${selectedPreBookingId}/convert`, {
        method: "POST",
        body: JSON.stringify({
          unitId: selectedUnitId,
          checkIn: toNoonISO(checkInDate),
          checkOut: toNoonISO(checkOutDate),
          totalAmount: finalTotal,
          currency: "NGN",
        }),
      });
      toast.success("Pre-booking converted to booking");
    } else {
      await apiFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          unitId: selectedUnitId,
          checkIn: toNoonISO(checkInDate),
          checkOut: toNoonISO(checkOutDate),
          guestId,
          totalAmount: finalTotal,
          currency: "NGN",
        }),
      });
      toast.success("Booking created");
    }

    setShowBookingDialog(false);

    // ✅ reset form
    setSelectedPropertyId("");
    setSelectedUnitId("");
    setUnits([]);
    setRange(undefined);
    setUnitBookings([]);
    setEditableTotal("");
    setTotalTouched(false);
    setBookingSubmitAttempted(false);
    setBookingTouched({
      property: false,
      unit: false,
      dates: false,
      guest: false,
      preBooking: false,
      total: false,
    });
    setBookingMode("NEW");
    setSelectedPreBookingId("");

    setGuestQuery("");
    setGuestResults([]);
    setSelectedGuest(null);

    // ✅ IMPORTANT: re-fetch so list includes guest object + name/email
    await fetchBookings("", { append: false, cursor: null });
    await fetchPreBookings();
  } catch (e: any) {
    toast.error(e?.message || "Failed to create booking");
  } finally {
    setCreatingBooking(false);
  }
}

  /* ================= PAYMENT ================= */

  async function handleRecordPayment() {
    if (recordingPayment) return;
    if (!selectedBooking) return;

    if (!canTakePayment(selectedBooking.paymentStatus)) {
      toast.error("Payment allowed only for UNPAID or PARTPAID bookings");
      return;
    }

    const amt = toMoneyString(paymentForm.amount);
    const amtNum = toNumberSafe(amt);

    if (!amt || !Number.isFinite(amtNum) || amtNum < 0 || (!allowZeroPayment && amtNum <= 0)) {
      toast.error(allowZeroPayment ? "Enter a valid amount (0 or greater)." : "Enter a valid amount greater than 0.");
      return;
    }

    if (!paymentForm.reference) {
      toast.error("Reference is required");
      return;
    }

    try {
      setRecordingPayment(true);
      await apiFetch(`/api/bookings/${selectedBooking.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          currency: paymentForm.currency,
          reference: paymentForm.reference,
          notes: paymentForm.notes || null,
        }),
      });

      toast.success("Payment recorded");

      await fetchBookings(bookingsQuery, { append: false, cursor: null });

      setShowPaymentDialog(false);
      setSelectedBooking(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function handleUpdateBooking() {
    if (updatingBooking) return;
    if (!editingBooking) return;
    if (!editForm.checkIn || !editForm.checkOut) {
      toast.error("Check-in and check-out are required.");
      return;
    }

    const checkInDate = new Date(`${editForm.checkIn}T12:00:00`);
    const checkOutDate = new Date(`${editForm.checkOut}T12:00:00`);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      toast.error("Invalid date value.");
      return;
    }
    if (checkOutDate <= checkInDate) {
      toast.error("Check-out must be after check-in.");
      return;
    }

    const amount = toMoneyString(editForm.totalAmount);
    const amountNum = Number(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid total amount.");
      return;
    }

    try {
      setUpdatingBooking(true);
      await apiFetch(`/api/bookings/${editingBooking.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          checkIn: toNoonISO(checkInDate),
          checkOut: toNoonISO(checkOutDate),
          totalAmount: amount,
        }),
      });
      toast.success("Booking updated");
      setShowEditDialog(false);
      setEditingBooking(null);
      await fetchBookings(bookingsQuery, { append: false, cursor: null });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update booking");
    } finally {
      setUpdatingBooking(false);
    }
  }

  async function handleDeleteBooking(booking: Booking) {
    if (deletingBookingId) return;
    if (!window.confirm("Delete this booking? This cannot be undone.")) return;
    try {
      setDeletingBookingId(booking.id);
      await apiFetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
      toast.success("Booking deleted");
      await fetchBookings(bookingsQuery, { append: false, cursor: null });
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete booking");
    } finally {
      setDeletingBookingId(null);
    }
  }

  /* ================= UI ================= */

  if (loading) return <div className="p-10 text-center">Loading bookings…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground mt-2">Create bookings, record payments, and track status.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchBookings(bookingsQuery, { append: false, cursor: null })}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Dialog
            open={showPreBookingDialog}
            onOpenChange={(open) => {
              setShowPreBookingDialog(open);
              if (!open) {
                setSelectedPreGuest(null);
                setPreGuestQuery("");
                setPreGuestResults([]);
                setShowPreNewGuest(false);
                setPreNewGuestForm({ fullName: "", email: "", phone: "", idNumber: "" });
                setPreBookingForm({
                  plannedCheckIn: "",
                  plannedCheckOut: "",
                  amountPaid: "",
                  notes: "",
                });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Pre-Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Pre-Booking</DialogTitle>
                <DialogDescription>
                  Capture guest + advance payment before room assignment. Room will be selected at booking stage.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Guest</Label>
                  {selectedPreGuest ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{selectedPreGuest.fullName}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {selectedPreGuest.phone ? `📞 ${selectedPreGuest.phone}` : "—"}{" "}
                          {selectedPreGuest.email ? `• ✉️ ${selectedPreGuest.email}` : ""}
                          {selectedPreGuest.idNumber ? ` • ID: ${selectedPreGuest.idNumber}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPreGuest(null);
                          setPreGuestQuery("");
                          setPreGuestResults([]);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          placeholder="Search guest by name, phone, email, ID..."
                          value={preGuestQuery}
                          onChange={(e) => setPreGuestQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowPreNewGuest(true);
                            setPreNewGuestForm((p) => ({
                              ...p,
                              fullName: preGuestQuery.trim() || p.fullName,
                            }));
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          New Guest
                        </Button>
                        {preGuestSearching ? <span className="text-xs text-muted-foreground">Searching…</span> : null}
                      </div>
                      {preGuestQuery.trim() && !preGuestSearching ? (
                        preGuestResults.length > 0 ? (
                          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                            {preGuestResults.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-b-0"
                                onClick={() => {
                                  setSelectedPreGuest(g);
                                  setPreGuestResults([]);
                                }}
                              >
                                <p className="font-medium">{g.fullName}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {g.phone ? `📞 ${g.phone}` : "—"} {g.email ? `• ✉️ ${g.email}` : ""}{" "}
                                  {g.idNumber ? `• ID: ${g.idNumber}` : ""}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No matching guest. Click <b>New Guest</b> to create.
                          </p>
                        )
                      ) : null}
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Planned Check-in</Label>
                    <Input
                      type="date"
                      value={preBookingForm.plannedCheckIn}
                      onChange={(e) => setPreBookingForm((p) => ({ ...p, plannedCheckIn: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Planned Check-out</Label>
                    <Input
                      type="date"
                      value={preBookingForm.plannedCheckOut}
                      onChange={(e) => setPreBookingForm((p) => ({ ...p, plannedCheckOut: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Amount Paid (NGN)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={preBookingForm.amountPaid}
                    onChange={(e) => setPreBookingForm((p) => ({ ...p, amountPaid: toMoneyString(e.target.value) }))}
                    placeholder="50000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={preBookingForm.notes}
                    onChange={(e) => setPreBookingForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Any instruction for this pre-booking"
                  />
                </div>
                <Button onClick={handleCreatePreBooking} className="w-full" disabled={creatingPreBooking}>
                  {creatingPreBooking ? "Creating pre-booking..." : "Create Pre-Booking"}
                </Button>

                <Dialog open={showPreNewGuest} onOpenChange={setShowPreNewGuest}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create Guest</DialogTitle>
                      <DialogDescription>
                        Add guest profile and assign it directly to this pre-booking.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={preNewGuestForm.fullName}
                          onChange={(e) => setPreNewGuestForm((p) => ({ ...p, fullName: e.target.value }))}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={preNewGuestForm.phone}
                            onChange={(e) => setPreNewGuestForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+234..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={preNewGuestForm.email}
                            onChange={(e) => setPreNewGuestForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>ID Number (optional)</Label>
                        <Input
                          value={preNewGuestForm.idNumber}
                          onChange={(e) => setPreNewGuestForm((p) => ({ ...p, idNumber: e.target.value }))}
                          placeholder="NIN / Passport / Driver’s license..."
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowPreNewGuest(false)} disabled={creatingPreGuest}>
                          Cancel
                        </Button>
                        <Button onClick={createPreGuestAndSelect} disabled={creatingPreGuest}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          {creatingPreGuest ? "Creating guest..." : "Create Guest"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={showBookingDialog}
            onOpenChange={(open) => {
              setShowBookingDialog(open);
              if (!open) {
                setBookingSubmitAttempted(false);
                setBookingTouched({
                  property: false,
                  unit: false,
                  dates: false,
                  guest: false,
                  preBooking: false,
                  total: false,
                });
                setGuestQuery("");
                setGuestResults([]);
                setSelectedGuest(null);
                setShowNewGuest(false);
                setNewGuestForm({ fullName: "", email: "", phone: "", idNumber: "" });
                setBookingMode("NEW");
                setSelectedPreBookingId("");
                setSelectedPropertyId("");
                setUnits([]);
                setSelectedUnitId("");
                setRange(undefined);
                setUnitBookings([]);
                setEditableTotal("");
                setTotalTouched(false);
                lastPricingKeyRef.current = "";
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Booking
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Booking</DialogTitle>
                <DialogDescription>
                  Complete all required fields. Dates with booking conflicts are unavailable.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className={bookingMode === "PREBOOKING" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : ""}>
                  <div className="space-y-2">
                    <Label>Booking Source</Label>
                    <select
                      className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent bg-background"
                      value={bookingMode}
                      onChange={(e) => {
                        const nextMode = e.target.value as "NEW" | "PREBOOKING";
                        setBookingMode(nextMode);
                        setBookingTouched((prev) => ({ ...prev, preBooking: true, guest: true }));
                        setSelectedPreBookingId("");
                        setSelectedGuest(null);
                        setGuestQuery("");
                        setGuestResults([]);
                      }}
                    >
                      <option value="NEW">New booking</option>
                      <option value="PREBOOKING">From pre-booking</option>
                    </select>
                  </div>

                  {bookingMode === "PREBOOKING" ? (
                    <div className="space-y-2">
                      <Label>Pre-Booking</Label>
                      <select
                        className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent bg-background"
                        value={selectedPreBookingId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedPreBookingId(id);
                          setBookingTouched((prev) => ({ ...prev, preBooking: true }));
                          const selected = preBookings.find((p) => p.id === id);
                          if (selected?.plannedCheckIn && selected?.plannedCheckOut) {
                            setRange({
                              from: new Date(selected.plannedCheckIn),
                              to: new Date(selected.plannedCheckOut),
                            });
                          }
                        }}
                      >
                        <option value="">Select pre-booking</option>
                        {preBookings.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.guestName} • {formatMaybeNGN(p.amountPaid)} • {p.id.slice(0, 8).toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                {bookingMode === "PREBOOKING" ? (
                  <>
                    {showFieldError("preBooking") ? (
                      <p className="text-xs text-red-600">{bookingErrors.preBooking}</p>
                    ) : null}
                    {selectedPreBooking ? (
                      <p className="text-xs text-muted-foreground">
                        Pre-booked by {selectedPreBooking.guestName}
                        {selectedPreBooking.guestPhone ? ` • ${selectedPreBooking.guestPhone}` : ""}
                        {selectedPreBooking.guestEmail ? ` • ${selectedPreBooking.guestEmail}` : ""}
                        {" • "}
                        Paid: {formatMaybeNGN(selectedPreBooking.amountPaid)}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {/* Property */}
                <div className="space-y-2">
                  <Label>Property</Label>
                  <select
                    className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent bg-background"
                    value={selectedPropertyId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setBookingTouched((prev) => ({ ...prev, property: true }));
                      setSelectedPropertyId(pid);
                      setSelectedUnitId("");
                      setRange(undefined);
                      setUnitBookings([]);
                      setEditableTotal("");
                      setTotalTouched(false);
                      if (!pid) {
                        setUnits([]);
                        setUnitsLoading(false);
                        return;
                      }

                      const cachedUnits = unitsByProperty[pid];
                      if (cachedUnits) {
                        setUnits(cachedUnits);
                        setUnitsLoading(false);
                      } else {
                        setUnits([]);
                        setUnitsLoading(true);
                      }
                      void fetchUnits(pid);
                    }}
                  >
                    <option value="">Select property</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type})
                      </option>
                    ))}
                  </select>
                  {showFieldError("property") ? <p className="text-xs text-red-600">{bookingErrors.property}</p> : null}
                </div>

                {/* Unit */}
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <select
                    className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent bg-background disabled:opacity-60"
                    value={selectedUnitId}
                    disabled={!selectedPropertyId || unitsLoading}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setBookingTouched((prev) => ({ ...prev, unit: true, dates: false }));
                      setSelectedUnitId(uid);
                      setRange(undefined);
                      setUnitBookings([]);
                      setEditableTotal("");
                      setTotalTouched(false);
                      if (uid) fetchBookingsForUnit(uid);
                    }}
                  >
                    <option value="">
                      {!selectedPropertyId
                        ? "Select property first"
                        : unitsLoading
                        ? "Loading units..."
                        : "Select unit"}
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} • {u.type} • cap {u.capacity} • {formatMaybeNGN(u.basePrice)}
                        {u.discountType && u.discountValue && u.discountStart && u.discountEnd
                          ? ` • promo ${u.discountType === "PERCENT" ? `${u.discountValue}%` : formatMaybeNGN(u.discountValue)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {showFieldError("unit") ? <p className="text-xs text-red-600">{bookingErrors.unit}</p> : null}
                </div>

                {/* Dates */}
                <div className="space-y-2">
                  <Label>
                    Dates{" "}
                    <p className="text-xs text-slate-400">
                      First click sets check-in, second click sets check-out. Unavailable dates already booked are
                      blocked. Check-in can be backdated by up to 1 day for overnight walk-in capture.
                    </p>
                  </Label>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-11 w-full justify-start text-left font-normal",
                          !range?.from && "text-muted-foreground"
                        )}
                        disabled={!selectedUnitId}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {range?.from
                          ? formatRange(range)
                          : selectedUnitId
                          ? "Pick check-in and check-out"
                          : "Select a unit first"}
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-[calc(100vw-1.5rem)] max-w-[44rem] overflow-x-auto p-2 sm:w-auto sm:p-4"
                      align="center"
                      collisionPadding={12}
                    >
                      <Calendar
                        mode="range"
                        selected={range}
                        onSelect={(nextRange) => {
                          setBookingTouched((prev) => ({ ...prev, dates: true }));
                          setRange(nextRange);
                        }}
                        numberOfMonths={calendarMonths}
                        className="min-w-[18rem]"
                        disabled={(date) => {
                          const today = lagosDayNumber(new Date());
                          const earliestAllowed = today - BOOKING_BACKDATE_DAYS_ALLOWED;
                          const d = lagosDayNumber(date);
                          if (d < earliestAllowed) return true;
                          if (!range?.from || range?.to) {
                            return isDateBooked(date);
                          }
                          const fromDay = lagosDayNumber(range.from);
                          const toDay = d;
                          if (toDay <= fromDay) return true;
                          return unitBookings.some((b) => {
                            const s = lagosDayNumber(new Date(b.checkIn));
                            const e = lagosDayNumber(new Date(b.checkOut));
                            return fromDay < e && toDay > s;
                          });
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {showFieldError("dates") ? <p className="text-xs text-red-600">{bookingErrors.dates}</p> : null}
                  {!showFieldError("dates") && selectedUnitId ? (
                    <p className="text-xs text-muted-foreground">
                      Tip: You can set check-out on the same day another booking checks in.
                    </p>
                  ) : null}
                </div>

                {/* Total */}
                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Total Amount</p>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">₦</span>
                      <Input
                        className="h-9 w-40 text-right font-semibold"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={editableTotal}
                        disabled={!totalAmount}
                        onChange={(e) => {
                          setTotalTouched(true);
                          setBookingTouched((prev) => ({ ...prev, total: true }));
                          setEditableTotal(toMoneyString(e.target.value));
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {selectedUnit && nights > 0
                      ? `${nights} night(s) • effective total ${formatMaybeNGN(totalAmount)}`
                      : "Select unit and dates to compute total."}
                  </p>

                  {totalAmount && editableTotal && editableTotal !== totalAmount && (
                    <p className="text-xs text-amber-700">
                      Discount applied:{" "}
                      {formatMaybeNGN(
                        Math.max(0, (toNumberSafe(totalAmount) || 0) - (toNumberSafe(editableTotal) || 0))
                      )}
                    </p>
                  )}
                  {showFieldError("total") ? <p className="text-xs text-red-600">{bookingErrors.total}</p> : null}
                </div>

                {/* ✅ Guest Selector */}
                {bookingMode === "NEW" ? (
                <div className="space-y-2">
                  <Label>Guest</Label>

                  {selectedGuest ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{selectedGuest.fullName}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {selectedGuest.phone ? `📞 ${selectedGuest.phone}` : "—"}{" "}
                          {selectedGuest.email ? `• ✉️ ${selectedGuest.email}` : ""}
                          {selectedGuest.idNumber ? ` • ID: ${selectedGuest.idNumber}` : ""}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBookingTouched((prev) => ({ ...prev, guest: true }));
                          setSelectedGuest(null);
                          setGuestQuery("");
                          setGuestResults([]);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          placeholder="Search guest by name, phone, email, ID..."
                          value={guestQuery}
                          onChange={(e) => setGuestQuery(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowNewGuest(true);
                            setNewGuestForm((p) => ({
                              ...p,
                              fullName: guestQuery.trim() || p.fullName,
                            }));
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          New Guest
                        </Button>

                        {guestSearching ? (
                          <span className="text-xs text-muted-foreground">Searching…</span>
                        ) : null}
                      </div>

                      {guestQuery.trim() && !guestSearching ? (
                        guestResults.length > 0 ? (
                          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                            {guestResults.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-b-0"
                                onClick={() => {
                                  setBookingTouched((prev) => ({ ...prev, guest: true }));
                                  setSelectedGuest(g);
                                  setGuestResults([]);
                                }}
                              >
                                <p className="font-medium">{g.fullName}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {g.phone ? `📞 ${g.phone}` : "—"} {g.email ? `• ✉️ ${g.email}` : ""}{" "}
                                  {g.idNumber ? `• ID: ${g.idNumber}` : ""}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No matching guest. Click <b>New Guest</b> to create.
                          </p>
                        )
                      ) : null}
                      {showFieldError("guest") ? <p className="text-xs text-red-600">{bookingErrors.guest}</p> : null}
                    </>
                  )}
                </div>
                ) : null}

                {/* ✅ Inline New Guest dialog (keeps Booking dialog open) */}
                {bookingMode === "NEW" ? (
                <Dialog open={showNewGuest} onOpenChange={setShowNewGuest}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create Guest</DialogTitle>
                      <DialogDescription>
                        Add a guest profile and assign it directly to this booking.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={newGuestForm.fullName}
                          onChange={(e) => setNewGuestForm((p) => ({ ...p, fullName: e.target.value }))}
                          placeholder="John Doe"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={newGuestForm.phone}
                            onChange={(e) => setNewGuestForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+234..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={newGuestForm.email}
                            onChange={(e) => setNewGuestForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>ID Number (optional)</Label>
                        <Input
                          value={newGuestForm.idNumber}
                          onChange={(e) => setNewGuestForm((p) => ({ ...p, idNumber: e.target.value }))}
                          placeholder="NIN / Passport / Driver’s license..."
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowNewGuest(false)} disabled={creatingGuest}>
                          Cancel
                        </Button>
                        <Button onClick={createGuestAndSelect} disabled={creatingGuest}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          {creatingGuest ? "Creating guest..." : "Create Guest"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                ) : null}

                <Button onClick={handleCreateBooking} className="w-full" disabled={!isBookingFormValid || creatingBooking}>
                  {creatingBooking
                    ? bookingMode === "PREBOOKING"
                      ? "Converting pre-booking..."
                      : "Creating booking..."
                    : bookingMode === "PREBOOKING"
                    ? "Convert to Booking"
                    : "Create Booking"}
                </Button>
                {!isBookingFormValid && bookingSubmitAttempted ? (
                  <p className="text-xs text-red-600 text-center">Resolve form errors above to create booking.</p>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* BOOKINGS SEARCH */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search bookings by guest name, email, or phone..."
                value={bookingsQuery}
                onChange={(e) => setBookingsQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchBookings(bookingsQuery, { append: false, cursor: null });
                }}
              />
            </div>

            <Button onClick={() => fetchBookings(bookingsQuery, { append: false, cursor: null })} disabled={loading}>
              Search
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setBookingsQuery("");
                fetchBookings("", { append: false, cursor: null });
              }}
              disabled={loading && !bookingsQuery}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PRE-BOOKINGS LIST */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Pre-Bookings/Reservations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {preBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending pre-bookings.</p>
          ) : (
            preBookings.map((p) => (
              <div key={p.id} className="rounded-md border border-slate-200 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.guestName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Ref: {p.id.slice(0, 8).toUpperCase()}
                    {p.guestPhone ? ` • ${p.guestPhone}` : ""}
                    {p.guestEmail ? ` • ${p.guestEmail}` : ""}
                    {p.plannedCheckIn ? ` • CI ${formatDate(p.plannedCheckIn)}` : ""}
                    {p.plannedCheckOut ? ` • CO ${formatDate(p.plannedCheckOut)}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatMaybeNGN(p.amountPaid)}</p>
                  <p className="text-xs text-muted-foreground">{p.status}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* BOOKINGS LIST */}
      <div className="space-y-3">
        {bookings.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="py-10 text-center text-muted-foreground">
              {bookingsQuery.trim() ? "No bookings match your search." : "No bookings found."}
            </CardContent>
          </Card>
        ) : bookings.map((b) => {
          const outstandingNum = Number(b.outstandingAmount ?? 0);
          const canPay = canTakePayment(b.paymentStatus) && (!Number.isFinite(outstandingNum) || outstandingNum > 0.009);
          const canEditBooking = userRole === "ADMIN" || userRole === "MANAGER";
          const canDeleteBooking = userRole === "ADMIN";

       const name =
  (b.guest?.fullName && b.guest.fullName.trim()) ||
  (b.guestName && b.guestName.trim()) ||
  "Guest";

const email =
  (b.guest?.email && b.guest.email.trim()) ||
  (b.guestEmail && b.guestEmail.trim()) ||
  "";

          return (
            <Card key={b.id} className="border-slate-200 md:mt-0">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
<CardTitle className="text-lg truncate">
  {name}{" "}
  {email ? (
    <span className="text-sm font-normal text-muted-foreground">({email})</span>
  ) : null}
</CardTitle>

                    <p className="text-sm text-muted-foreground mt-1">
                      Unit: {unitMap?.[b.unitId] ?? b.unitId} • Check-in: {formatDate(b.checkIn)} • Check-out:{" "}
                      {formatDate(b.checkOut)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Status: {b.status}
                      </span>

                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          isUnpaid(b.paymentStatus) && "bg-slate-100 text-slate-800",
                          isPartPaid(b.paymentStatus) && "bg-amber-100 text-amber-800",
                          String(b.paymentStatus || "").toUpperCase() === "PAID" && "bg-emerald-100 text-emerald-800"
                        )}
                      >
                        Payment: {b.paymentStatus}
                      </span>

                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100">
                        Total: {formatMaybeNGN(b.totalAmount)}
                      </span>

                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-100">
                        Outstanding: {formatMaybeNGN(b.outstandingAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEditBooking ? (
                      <Button
                        variant="outline"
                        disabled={updatingBooking || recordingPayment || creatingBooking || deletingBookingId === b.id}
                        onClick={() => {
                          setEditingBooking(b);
                          setEditForm({
                            checkIn: toDateInput(b.checkIn),
                            checkOut: toDateInput(b.checkOut),
                            totalAmount: String(b.totalAmount ?? ""),
                          });
                          setShowEditDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                    ) : null}
                    {canDeleteBooking ? (
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        disabled={Boolean(deletingBookingId)}
                        onClick={() => handleDeleteBooking(b)}
                      >
                        {deletingBookingId === b.id ? "Deleting..." : "Delete"}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      disabled={!canPay || recordingPayment}
                      onClick={() => {
                        if (!canPay) return;
                        setSelectedBooking(b);
                        setShowPaymentDialog(true);
                      }}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Payment
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchBookings(bookingsQuery, { append: true, cursor: nextCursor })}
            disabled={loading || !nextCursor}
          >
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}

      {/* PAYMENT DIALOG */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter the amount received and include a payment reference for reconciliation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>
                Amount{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Partial deposit or Full payment{allowZeroPayment ? " • 0 allowed by policy" : ""})
                </span>
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: toMoneyString(e.target.value) })}
              />
            </div>

            <div>
              <Label>
                Reference{" "}
                <span className="text-xs font-normal text-muted-foreground">(Cash or Transfer + RefXXXX)</span>
              </Label>
              <Input
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              />
            </div>

            <div>
              <Label>
                Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Any note about this payment..."
              />
            </div>

            <Button onClick={handleRecordPayment} className="w-full">
              {recordingPayment ? "Recording payment..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
            <DialogDescription>
              Update dates and total amount. Managers can edit only bookings in assigned properties.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Check-in date</Label>
              <Input
                type="date"
                value={editForm.checkIn}
                onChange={(e) => setEditForm((p) => ({ ...p, checkIn: e.target.value }))}
              />
            </div>
            <div>
              <Label>Check-out date</Label>
              <Input
                type="date"
                value={editForm.checkOut}
                onChange={(e) => setEditForm((p) => ({ ...p, checkOut: e.target.value }))}
              />
            </div>
            <div>
              <Label>Total amount (NGN)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={editForm.totalAmount}
                onChange={(e) => setEditForm((p) => ({ ...p, totalAmount: toMoneyString(e.target.value) }))}
              />
            </div>
            <Button className="w-full" onClick={handleUpdateBooking} disabled={updatingBooking}>
              {updatingBooking ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
