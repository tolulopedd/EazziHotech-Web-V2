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
}

type Guest = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
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

type BookingFormField = "property" | "unit" | "dates" | "guest" | "total";
type BookingFormErrors = Partial<Record<BookingFormField, string>>;

const formatNGN = (value: number) =>
  `₦${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

function formatMaybeNGN(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatNGN(n);
}

/* ================= HELPERS ================= */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffNights(from: Date, to: Date) {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
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

function formatRange(r?: DateRange) {
  if (!r?.from) return "";
  if (!r.to) return r.from.toDateString();
  return `${r.from.toDateString()} → ${r.to.toDateString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const [day, mon, year] = d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .split(" ");
  return `${day}-${mon}-${year}`;
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingsQuery, setBookingsQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);

  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

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
    total: false,
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    currency: "NGN",
    reference: "",
    notes: "",
  });

  const [unitMap, setUnitMap] = useState<Record<string, string>>({});

  // Derived: selected unit, nights, totalAmount
  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedUnitId), [units, selectedUnitId]);

  const nights = useMemo(() => {
    if (!range?.from || !range?.to) return 0;
    return diffNights(range.from, range.to);
  }, [range?.from, range?.to]);

  const totalAmount = useMemo(() => {
    if (!selectedUnit || !range?.from || !range?.to) return null;
    if (nights <= 0) return null;

    const bp = Number(selectedUnit.basePrice);
    if (!Number.isFinite(bp) || bp <= 0) return null;

    return money2(bp * nights);
  }, [selectedUnit, range?.from, range?.to, nights]);

  const hasDateRangeOverlap = useMemo(() => {
    if (!range?.from || !range?.to) return false;
    const fromMs = startOfDay(range.from).getTime();
    const toMs = startOfDay(range.to).getTime();
    if (toMs <= fromMs) return true;
    return unitBookings.some((b) => {
      const s = startOfDay(new Date(b.checkIn)).getTime();
      const e = startOfDay(new Date(b.checkOut)).getTime();
      return fromMs < e && toMs > s;
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

    if (!selectedGuest?.id) next.guest = "Select an existing guest or create a new one.";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function fetchUnits(propertyId: string) {
    try {
      const data = await apiFetch(`/api/properties/${propertyId}/units`);
      const list = (data.units || []) as Unit[];
      setUnits(list);

      setUnitMap((prev) => {
        const next = { ...prev };
        for (const u of list) next[u.id] = u.name;
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load units");
    }
  }

  async function hydrateUnitMapFromAllProperties(propsList?: Property[]) {
    try {
      const list = propsList ?? properties;
      if (!list || list.length === 0) return;

      const results = await Promise.allSettled(list.map((p) => apiFetch(`/api/properties/${p.id}/units`)));

      const nextMap: Record<string, string> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          const units = (r.value?.units || []) as Unit[];
          for (const u of units) nextMap[u.id] = u.name;
        }
      }

      setUnitMap((prev) => ({ ...prev, ...nextMap }));
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
    const t = startOfDay(date).getTime();
    return unitBookings.some((b) => {
      const s = startOfDay(new Date(b.checkIn)).getTime();
      const e = startOfDay(new Date(b.checkOut)).getTime();
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
    }
  }

  /* ================= CREATE BOOKING ================= */

async function handleCreateBooking() {
  setBookingSubmitAttempted(true);
  if (!isBookingFormValid) {
    toast.error("Please resolve highlighted booking form errors.");
    return;
  }
  const checkInDate = range?.from;
  const checkOutDate = range?.to;
  const guestId = selectedGuest?.id;
  if (!checkInDate || !checkOutDate || !guestId) return;

  const finalTotal = editableTotal ? money2(toNumberSafe(editableTotal)) : String(totalAmount ?? "");
  const finalNum = toNumberSafe(finalTotal);

  if (!Number.isFinite(finalNum) || finalNum <= 0) {
    toast.error("Total amount must be a valid number greater than 0.");
    return;
  }

  try {
    await apiFetch("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        unitId: selectedUnitId,
        checkIn: toNoonISO(checkInDate),
        checkOut: toNoonISO(checkOutDate),

        // ✅ link guest
        guestId,

        totalAmount: finalTotal,
        currency: "NGN",
      }),
    });

    toast.success("Booking created");
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
      total: false,
    });

    setGuestQuery("");
    setGuestResults([]);
    setSelectedGuest(null);

    // ✅ IMPORTANT: re-fetch so list includes guest object + name/email
    await fetchBookings("", { append: false, cursor: null });
  } catch (e: any) {
    toast.error(e?.message || "Failed to create booking");
  }
}

  /* ================= PAYMENT ================= */

  async function handleRecordPayment() {
    if (!selectedBooking) return;

    if (!canTakePayment(selectedBooking.paymentStatus)) {
      toast.error("Payment allowed only for UNPAID or PARTPAID bookings");
      return;
    }

    const amt = toMoneyString(paymentForm.amount);
    const amtNum = toNumberSafe(amt);

    if (!amt || !Number.isFinite(amtNum) || amtNum <= 0) {
      toast.error("Enter a valid amount greater than 0.");
      return;
    }

    if (!paymentForm.reference) {
      toast.error("Reference is required");
      return;
    }

    try {
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
                  total: false,
                });
                setGuestQuery("");
                setGuestResults([]);
                setSelectedGuest(null);
                setShowNewGuest(false);
                setNewGuestForm({ fullName: "", email: "", phone: "", idNumber: "" });
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
                      setUnits([]);
                      setRange(undefined);
                      setUnitBookings([]);
                      setEditableTotal("");
                      setTotalTouched(false);
                      if (pid) fetchUnits(pid);
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
                    disabled={!selectedPropertyId}
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
                    <option value="">{selectedPropertyId ? "Select unit" : "Select property first"}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} • {u.type} • cap {u.capacity} • ₦{u.basePrice}
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
                      blocked.
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

                    <PopoverContent className="w-auto h-auto p-4" align="start">
                      <Calendar
                        mode="range"
                        selected={range}
                        onSelect={(nextRange) => {
                          setBookingTouched((prev) => ({ ...prev, dates: true }));
                          setRange(nextRange);
                        }}
                        numberOfMonths={2}
                        disabled={(date) => {
                          const today = startOfDay(new Date());
                          const d = startOfDay(date);
                          if (d < today) return true;
                          if (!range?.from || range?.to) {
                            return isDateBooked(d);
                          }
                          const fromMs = startOfDay(range.from).getTime();
                          const toMs = d.getTime();
                          if (toMs <= fromMs) return true;
                          return unitBookings.some((b) => {
                            const s = startOfDay(new Date(b.checkIn)).getTime();
                            const e = startOfDay(new Date(b.checkOut)).getTime();
                            return fromMs < e && toMs > s;
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
                      ? `${nights} night(s) × ₦${selectedUnit.basePrice} = ₦${totalAmount}`
                      : "Select unit and dates to compute total."}
                  </p>

                  {totalAmount && editableTotal && editableTotal !== totalAmount && (
                    <p className="text-xs text-amber-700">
                      Discount applied: ₦
                      {money2(
                        Math.max(0, (toNumberSafe(totalAmount) || 0) - (toNumberSafe(editableTotal) || 0))
                      )}
                    </p>
                  )}
                  {showFieldError("total") ? <p className="text-xs text-red-600">{bookingErrors.total}</p> : null}
                </div>

                {/* ✅ Guest Selector */}
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

                {/* ✅ Inline New Guest dialog (keeps Booking dialog open) */}
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
                        <Button variant="outline" onClick={() => setShowNewGuest(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createGuestAndSelect}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create Guest
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button onClick={handleCreateBooking} className="w-full" disabled={!isBookingFormValid}>
                  Create Booking
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
                    <Button
                      variant="outline"
                      disabled={!canPay}
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
                <span className="text-xs font-normal text-muted-foreground">(Partial deposit or Full payment)</span>
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
              Record Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
