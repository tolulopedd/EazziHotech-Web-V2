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

interface Property {
  id: string;
  name: string;
  type: string;
  address?: string;
}

interface Unit {
  id: string;
  propertyId: string;
  name: string;
  type: string;
  capacity: number;
  basePrice: string;
}

interface Booking {
  id: string;
  tenantId: string;
  unitId: string;

  status: string;
  paymentStatus: string;

  checkIn: string;
  checkOut: string;

  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;

  createdAt: string;
  updatedAt: string;
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


function toNoonISO(date: Date) {
  // Noon UTC prevents timezone shifting issues
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
  return d.toISOString();
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatRange(r?: DateRange) {
  if (!r?.from) return "";
  if (!r.to) return r.from.toDateString();
  return `${r.from.toDateString()} → ${r.to.toDateString()}`;
}

export default function Bookings() {
  // main list
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // property/unit selection for create booking
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  // calendar
  const [range, setRange] = useState<DateRange | undefined>();
  const [unitBookings, setUnitBookings] = useState<Booking[]>([]);

  // create booking guest form (unit/dates come from selectors)
  const [bookingForm, setBookingForm] = useState({
    guestName: "John Doe",
    guestEmail: "john@example.com",
    guestPhone: "",
  });

  const [unitMap, setUnitMap] = useState<Record<string, string>>({});

  // payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: "90000.00",
    currency: "NGN",
    reference: "Bank transfer - Jan21",
  });

  useEffect(() => {
    fetchBookings();
    fetchProperties();
  }, []);

  async function fetchBookings() {
    try {
      setLoading(true);
      const data = await apiFetch("/api/bookings");
      setBookings(data.bookings || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

async function fetchProperties() {
  try {
    const data = await apiFetch("/api/properties");
    const propsList = (data.properties || []) as Property[];
    setProperties(propsList);

    // ✅ build unitMap for list display
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



  async function fetchBookingsForUnit(unitId: string) {
    try {
      const data = await apiFetch(`/api/bookings?unitId=${encodeURIComponent(unitId)}`);
      const list: Booking[] = data.bookings || [];

      // Only block dates for active bookings
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

    // block [checkIn, checkOut) — checkOut day is allowed as next booking start
    return unitBookings.some((b) => {
      const s = startOfDay(new Date(b.checkIn)).getTime();
      const e = startOfDay(new Date(b.checkOut)).getTime();
      return t >= s && t < e;
    });
  }


  async function hydrateUnitMapFromAllProperties(propsList?: Property[]) {
  try {
    const list = propsList ?? properties;
    if (!list || list.length === 0) return;

    const results = await Promise.allSettled(
      list.map((p) => apiFetch(`/api/properties/${p.id}/units`))
    );

    const nextMap: Record<string, string> = {};

    for (const r of results) {
      if (r.status === "fulfilled") {
        const units = (r.value?.units || []) as Unit[];
        for (const u of units) nextMap[u.id] = u.name;
      }
    }

    setUnitMap((prev) => ({ ...prev, ...nextMap }));
  } catch {
    // Silent: bookings page should still work even if unit names fail
  }
}


  async function handleCreateBooking() {
    if (!selectedUnitId) {
      toast.error("Please select a unit");
      return;
    }
    if (!range?.from || !range?.to) {
      toast.error("Please select check-in and check-out dates");
      return;
    }

    const checkInISO = toNoonISO(range.from);
    const checkOutISO = toNoonISO(range.to);

    try {
      const data = await apiFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          unitId: selectedUnitId,
          checkIn: checkInISO,
          checkOut: checkOutISO,
          guestName: bookingForm.guestName || null,
          guestEmail: bookingForm.guestEmail || null,
          guestPhone: bookingForm.guestPhone ? bookingForm.guestPhone : null,
        }),
      });

      toast.success("Booking created");
      setShowBookingDialog(false);

      // Reset dialog state
      setSelectedPropertyId("");
      setSelectedUnitId("");
      setUnits([]);
      setRange(undefined);
      setUnitBookings([]);
      setBookingForm({
        guestName: "John Doe",
        guestEmail: "john@example.com",
        guestPhone: "",
      });

      // update list quickly
      if (data?.booking) {
        setBookings((prev) => [data.booking, ...prev]);
      } else {
        fetchBookings();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create booking");
    }
  }

  async function handleRecordPayment() {
    if (!selectedBooking) {
      toast.error("Select a booking first");
      return;
    }
    if (!paymentForm.amount || !paymentForm.currency || !paymentForm.reference) {
      toast.error("amount, currency and reference are required");
      return;
    }

    try {
      await apiFetch(`/api/bookings/${selectedBooking.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: paymentForm.amount,
          currency: paymentForm.currency,
          reference: paymentForm.reference,
        }),
      });

      toast.success("Payment recorded");
      setShowPaymentDialog(false);
      setSelectedBooking(null);
      fetchBookings();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment");
    }
  }

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });
  }, [bookings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="text-muted-foreground">Loading bookings...</p>
        </div>
      </div>
    );
  }

  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="text-muted-foreground mt-2">
            Create bookings, record payments, and track status.
          </p>
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
                      if (uid) fetchBookingsForUnit(uid);
                    }}
                  >
                    <option value="">
                      {selectedPropertyId ? "Select unit" : "Select property first"}
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} • {u.type} • cap {u.capacity} • ₦{u.basePrice}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-muted-foreground">
                    Unit ID is saved automatically (we show unit names here).
                  </p>
                </div>

                {/* Date range */}
                <div className="space-y-2">
                  <Label>Dates  <p className="text-xs text-slate-400">
                    First Click-Start Date, Second Click-End Date and Double click to reset.
                  </p></Label>

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

                  <p className="text-xs text-muted-foreground">
                    Past and already-booked dates are disabled.
                  </p>
                </div>

                {/* Guest */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Guest Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={bookingForm.guestName}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, guestName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Guest Email</Label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={bookingForm.guestEmail}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, guestEmail: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Guest Phone (optional)</Label>
                  <Input
                    placeholder="+234..."
                    value={bookingForm.guestPhone}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, guestPhone: e.target.value })
                    }
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

      {/* List */}
      {sortedBookings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No bookings yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedBookings.map((b) => (
            <Card key={b.id} className="border-slate-200">
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
 Unit: {unitMap?.[b.unitId] ?? b.unitId} • Check-in: {formatDate(b.checkIn)} • Check-out: {formatDate(b.checkOut)}

</p>


                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Status: {b.status}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        Payment: {b.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
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
          ))}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Record Payment{" "}
              <span className="text-sm text-muted-foreground font-normal">
                {selectedBooking ? `(${selectedBooking.id})` : ""}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                placeholder="90000.00"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, amount: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Currency</Label>
                <Input
                  placeholder="NGN"
                  value={paymentForm.currency}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, currency: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Reference</Label>
                <Input
                  placeholder="Bank transfer - Jan21"
                  value={paymentForm.reference}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, reference: e.target.value })
                  }
                />
              </div>
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
