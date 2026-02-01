import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Plus, CreditCard, RefreshCw } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

interface Booking {
  id: string;
  unitId: string;

  status: string;
  paymentStatus: string;

  checkIn: string;
  checkOut: string;

  guestName: string | null;
  guestEmail: string | null;

  totalAmount?: string | null;
  currency?: string;

  createdAt: string;
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

  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [range, setRange] = useState<DateRange | undefined>();
  const [unitBookings, setUnitBookings] = useState<Booking[]>([]);

  const [bookingForm, setBookingForm] = useState({
    guestName: "John Thomas",
    guestEmail: "johntom@eazzihotech.com",
    guestPhone: "",
  });

  const [editableTotal, setEditableTotal] = useState(""); // string decimal
  const [totalTouched, setTotalTouched] = useState(false);

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

  /* ================= EFFECTS ================= */

  useEffect(() => {
    fetchBookings();
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Prefill payment ONCE when dialog opens
  useEffect(() => {
    if (!showPaymentDialog || !selectedBooking) return;

    // For PARTPAID or UNPAID, default to remaining or total?
    // MVP: default to totalAmount (user can type partial amount)
    setPaymentForm({
      amount: selectedBooking.totalAmount ? String(selectedBooking.totalAmount) : "",
      currency: selectedBooking.currency || "NGN",
      reference: "",
      notes: "",
    });
  }, [showPaymentDialog, selectedBooking?.id]);

  // Auto-fill editable total from computed total (unless user edited)
  useEffect(() => {
    if (!totalAmount) return;
    if (!totalTouched) setEditableTotal(String(totalAmount));
  }, [totalAmount, totalTouched]);

  /* ================= API ================= */

  async function fetchBookings() {
    try {
      setLoading(true);
      const data = await apiFetch("/api/bookings");
      setBookings(data.bookings || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load bookings");
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
      const data = await apiFetch(`/api/bookings?unitId=${encodeURIComponent(unitId)}`);
      const list: Booking[] = data.bookings || [];

      const active = list.filter((b) =>
        ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(String(b.status).toUpperCase())
      );

      setUnitBookings(active);
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

  /* ================= CREATE BOOKING ================= */

  async function handleCreateBooking() {
    if (!selectedUnitId) return toast.error("Please select a unit");
    if (!range?.from || !range?.to) return toast.error("Please select check-in and check-out dates");
    if (!totalAmount) return toast.error("Total amount could not be calculated.");

    const finalTotal = editableTotal ? money2(toNumberSafe(editableTotal)) : totalAmount;
    const finalNum = toNumberSafe(finalTotal);

    if (!Number.isFinite(finalNum) || finalNum <= 0) {
      toast.error("Total amount must be a valid number greater than 0.");
      return;
    }

    try {
      const data = await apiFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          unitId: selectedUnitId,
          checkIn: toNoonISO(range.from),
          checkOut: toNoonISO(range.to),
          guestName: bookingForm.guestName || null,
          guestEmail: bookingForm.guestEmail || null,
          guestPhone: bookingForm.guestPhone ? bookingForm.guestPhone : null,
          totalAmount: finalTotal,
          currency: "NGN",
        }),
      });

      toast.success("Booking created");
      setShowBookingDialog(false);

      setSelectedPropertyId("");
      setSelectedUnitId("");
      setUnits([]);
      setRange(undefined);
      setUnitBookings([]);
      setBookingForm({ guestName: "John Thomas", guestEmail: "johntom@eazzihotech.com", guestPhone: "" });
      setEditableTotal("");
      setTotalTouched(false);

      if (data?.booking) setBookings((prev) => [data.booking, ...prev]);
      else fetchBookings();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create booking");
    }
  }

  /* ================= PAYMENT ================= */

  async function handleRecordPayment() {
    if (!selectedBooking) return;

    // ✅ allow payment for UNPAID or PARTPAID
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
          amount: amt, // ✅ backend expects string
          currency: paymentForm.currency,
          reference: paymentForm.reference,
          notes: paymentForm.notes || null,
        }),
      });

      toast.success("Payment recorded");

      // ✅ Do NOT force payment status on frontend anymore — backend recalculates
      await fetchBookings();

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
          <Button variant="outline" onClick={fetchBookings}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Booking
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Booking</DialogTitle>
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
                </div>

                {/* Dates */}
                <div className="space-y-2">
                  <Label>
                    Dates{" "}
                    <p className="text-xs text-slate-400">
                      First click = start date, second click = end date. Double click to reset.
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
                        onSelect={setRange}
                        numberOfMonths={2}
                        disabled={(date) => {
                          const today = startOfDay(new Date());
                          const d = startOfDay(date);
                          return d < today || isDateBooked(d);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
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
                </div>

                {/* Guest */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Guest Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={bookingForm.guestName}
                      onChange={(e) => setBookingForm({ ...bookingForm, guestName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Guest Email</Label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={bookingForm.guestEmail}
                      onChange={(e) => setBookingForm({ ...bookingForm, guestEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Guest Phone (optional)</Label>
                  <Input
                    placeholder="+234..."
                    value={bookingForm.guestPhone}
                    onChange={(e) => setBookingForm({ ...bookingForm, guestPhone: e.target.value })}
                  />
                </div>

                <Button onClick={handleCreateBooking} className="w-full">
                  Create Booking
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* BOOKINGS LIST */}
      <div className="space-y-3">
        {bookings.map((b) => {
          const canPay = canTakePayment(b.paymentStatus);

          return (
            <Card key={b.id} className="border-slate-200 md:mt-0">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">
                      {b.guestName || "Guest"}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {b.guestEmail ? `(${b.guestEmail})` : ""}
                      </span>
                    </CardTitle>

                    <p className="text-sm text-muted-foreground mt-1">
                      Unit: {unitMap?.[b.unitId] ?? b.unitId} • Check-in: {formatDate(b.checkIn)} • Check-out:{" "}
                      {formatDate(b.checkOut)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Status: {b.status}
                      </span>

                      {/* Payment badge */}
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
                        Total: ₦{b.totalAmount ?? "—"} {b.currency ?? "NGN"}
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

      {/* PAYMENT DIALOG */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
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
