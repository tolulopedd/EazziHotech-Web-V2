import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CalendarCheck2, RefreshCcw, Clipboard, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUpload, compressToMaxBytes } from "@/lib/upload";

/* ================= TYPES ================= */

type Booking = {
  id: string;
  guestId?: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  guestAddress?: string | null;
  guestNationality?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  idIssuedBy?: string | null;
  vehiclePlate?: string | null;
  totalAmount?: string | null;
  currency?: string | null;
  guestPhotoUrl?: string | null; // ✅ NEW
  guest?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    nationality?: string | null;
    idType?: string | null;
    idNumber?: string | null;
    idIssuedBy?: string | null;
    vehiclePlate?: string | null;
  } | null;
  unit?: {
    id: string;
    name: string;
    type: "ROOM" | "APARTMENT";
    property?: { name: string };
  };
};

/* ================= HELPERS ================= */

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toNullableString(value: string) {
  const next = value.trim();
  return next ? next : null;
}

function getErrorMessage(e: unknown, fallback: string) {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/* ================= COMPONENT ================= */

export default function CheckInPage() {
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(true);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // modal state
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const activeBookingIdRef = useRef<string>("");

  const [guestPhotoBlob, setGuestPhotoBlob] = useState<Blob | null>(null);
  const [guestPhotoPreview, setGuestPhotoPreview] = useState<string>("");
  const [guestPhotoSize, setGuestPhotoSize] = useState<number>(0);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [updateGuestProfile, setUpdateGuestProfile] = useState(false);

  const [checkInForm, setCheckInForm] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    address: "",
    nationality: "",
    idType: "NIN",
    idNumber: "",
    idIssuedBy: "",
    vehiclePlate: "",
    notes: "",
  });

  type CheckInFormState = typeof checkInForm;

  const countToday = useMemo(() => todayBookings.length, [todayBookings]);
  const guestNameError = !checkInForm.guestName.trim() ? "Guest name is required." : "";
  const guestEmailError = !isValidEmail(checkInForm.guestEmail) ? "Enter a valid email address." : "";
  const canSubmitCheckIn = Boolean(activeBooking) && !guestNameError && !guestEmailError && busyId !== activeBooking?.id;
  const linkedGuestId = activeBooking?.guestId || activeBooking?.guest?.id || "";

  const loadTodayArrivals = useCallback(async () => {
    setError("");
    setLoadingToday(true);
    try {
      const data = await apiFetch("/api/bookings/arrivals/today");
      setTodayBookings((data?.bookings ?? []) as Booking[]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load arrivals"));
      setTodayBookings([]);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const loadWeekArrivals = useCallback(async () => {
    setLoadingWeek(true);
    try {
      // ✅ You need this endpoint in backend: GET /api/bookings/arrivals/week
      const data = await apiFetch("/api/bookings/arrivals/week");
      const list = (data?.bookings ?? []) as Booking[];

      // Optional: ensure "today" isn't duplicated in week list
      const today0 = startOfDay(new Date()).getTime();
      const filtered = list.filter((b) => startOfDay(new Date(b.checkIn)).getTime() !== today0);

      setWeekBookings(filtered);
    } catch {
      setWeekBookings([]);
    } finally {
      setLoadingWeek(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTodayArrivals(), loadWeekArrivals()]);
  }, [loadTodayArrivals, loadWeekArrivals]);

  async function hydrateGuestFromMaster(bookingId: string, guestId: string, baseline: CheckInFormState) {
    try {
      const data = await apiFetch(`/api/guests/${encodeURIComponent(guestId)}`);
      const g = data?.guest as
        | {
            fullName?: string | null;
            email?: string | null;
            phone?: string | null;
            address?: string | null;
            nationality?: string | null;
            idType?: string | null;
            idNumber?: string | null;
            idIssuedBy?: string | null;
            vehiclePlate?: string | null;
          }
        | undefined;
      if (!g) return;
      if (activeBookingIdRef.current !== bookingId) return;

      const nextFromGuest: CheckInFormState = {
        ...baseline,
        guestName: g.fullName || baseline.guestName,
        guestPhone: g.phone || baseline.guestPhone,
        guestEmail: g.email || baseline.guestEmail,
        address: g.address || baseline.address,
        nationality: g.nationality || baseline.nationality,
        idType: g.idType || baseline.idType,
        idNumber: g.idNumber || baseline.idNumber,
        idIssuedBy: g.idIssuedBy || baseline.idIssuedBy,
        vehiclePlate: g.vehiclePlate || baseline.vehiclePlate,
      };

      setCheckInForm((prev) => ({
        ...prev,
        guestName: prev.guestName === baseline.guestName ? nextFromGuest.guestName : prev.guestName,
        guestPhone: prev.guestPhone === baseline.guestPhone ? nextFromGuest.guestPhone : prev.guestPhone,
        guestEmail: prev.guestEmail === baseline.guestEmail ? nextFromGuest.guestEmail : prev.guestEmail,
        address: prev.address === baseline.address ? nextFromGuest.address : prev.address,
        nationality: prev.nationality === baseline.nationality ? nextFromGuest.nationality : prev.nationality,
        idType: prev.idType === baseline.idType ? nextFromGuest.idType : prev.idType,
        idNumber: prev.idNumber === baseline.idNumber ? nextFromGuest.idNumber : prev.idNumber,
        idIssuedBy: prev.idIssuedBy === baseline.idIssuedBy ? nextFromGuest.idIssuedBy : prev.idIssuedBy,
        vehiclePlate: prev.vehiclePlate === baseline.vehiclePlate ? nextFromGuest.vehiclePlate : prev.vehiclePlate,
      }));
    } catch {
      // fallback silently to snapshot values already in form
    }
  }

  function openCheckInModal(b: Booking) {
    activeBookingIdRef.current = b.id;
    setActiveBooking(b);
    const guestMaster = b.guest ?? null;
    const baseline: CheckInFormState = {
      guestName: guestMaster?.fullName || b.guestName || "",
      guestPhone: guestMaster?.phone || b.guestPhone || "",
      guestEmail: guestMaster?.email || b.guestEmail || "",
      address: guestMaster?.address || b.guestAddress || "",
      nationality: guestMaster?.nationality || b.guestNationality || "",
      idType: guestMaster?.idType || b.idType || "NIN",
      idNumber: guestMaster?.idNumber || b.idNumber || "",
      idIssuedBy: guestMaster?.idIssuedBy || b.idIssuedBy || "",
      vehiclePlate: guestMaster?.vehiclePlate || b.vehiclePlate || "",
      notes: "",
    };
    setCheckInForm(baseline);
    setCheckInOpen(true);
    setGuestPhotoBlob(null);
    setGuestPhotoSize(0);
    setGuestPhotoPreview("");
    setSubmitAttempted(false);
    setUpdateGuestProfile(false);

    const bookingGuestId = b.guestId || b.guest?.id;
    if (bookingGuestId) {
      void hydrateGuestFromMaster(b.id, bookingGuestId, baseline);
    }
  }

  async function submitCheckIn() {
    if (!activeBooking) return;
    setSubmitAttempted(true);
    if (guestNameError || guestEmailError) {
      setError("Please resolve check-in form errors.");
      return;
    }

    setError("");
    setBusyId(activeBooking.id);

    try {
      // 1) Check-in
      await apiFetch(`/api/bookings/${activeBooking.id}/check-in`, {
        method: "POST",
        body: JSON.stringify({
          notes: toNullableString(checkInForm.notes),
          guestName: toNullableString(checkInForm.guestName),
          guestPhone: toNullableString(checkInForm.guestPhone),
          guestEmail: toNullableString(checkInForm.guestEmail),
          address: toNullableString(checkInForm.address),
          nationality: toNullableString(checkInForm.nationality),
          idType: toNullableString(checkInForm.idType),
          idNumber: toNullableString(checkInForm.idNumber),
          idIssuedBy: toNullableString(checkInForm.idIssuedBy),
          vehiclePlate: toNullableString(checkInForm.vehiclePlate),
          updateGuestProfile: Boolean(updateGuestProfile && linkedGuestId),
        }),
      });

      // 2) Upload photo (optional)
      if (guestPhotoBlob) {
        const fd = new FormData();
        fd.append("file", guestPhotoBlob, `guest-${activeBooking.id}.jpg`);
        await apiUpload(`/api/bookings/${activeBooking.id}/guest-photo`, fd);
      }

      setCheckInOpen(false);
      setActiveBooking(null);
      setSubmitAttempted(false);
      await refreshAll();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Check-in failed"));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    return () => {
      if (guestPhotoPreview) URL.revokeObjectURL(guestPhotoPreview);
    };
  }, [guestPhotoPreview]);

  async function handleGuestPhoto(file: File | null) {
    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    try {
      const blob = await compressToMaxBytes(file, 300 * 1024);

      setGuestPhotoBlob(blob);
      setGuestPhotoSize(blob.size);

      // preview
      const url = URL.createObjectURL(blob);
      if (guestPhotoPreview) URL.revokeObjectURL(guestPhotoPreview);
      setGuestPhotoPreview(url);
    } catch (e: unknown) {
      setGuestPhotoBlob(null);
      setGuestPhotoSize(0);
      if (guestPhotoPreview) URL.revokeObjectURL(guestPhotoPreview);
      setGuestPhotoPreview("");
      setError(getErrorMessage(e, "Failed to process photo."));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Check In</h1>
          <p className="text-muted-foreground mt-2">
            Confirm arrivals for today and review upcoming check-ins for the week.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={loadingToday || loadingWeek}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${(loadingToday || loadingWeek) ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm">
            Arrivals today: <span className="font-semibold text-indigo-700">{countToday}</span>
          </div>
        </div>
      </div>

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

      {/* TODAY */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-indigo-600" />
            Today’s Arrivals
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loadingToday ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-200 mx-auto" />
                <p className="text-muted-foreground">Loading arrivals…</p>
              </div>
            </div>
          ) : todayBookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CalendarCheck2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No arrivals found for today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayBookings.map((b) => {
                const unitName = b.unit?.name ?? "Unit";
                const propertyName = b.unit?.property?.name;
                const title = propertyName ? `${propertyName} — ${unitName}` : unitName;

                const canCheckIn = String(b.status).toUpperCase() === "CONFIRMED";
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
                              <span className="font-medium text-slate-700">{b.guestPhone}</span>
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
                      <Button
                        onClick={() => openCheckInModal(b)}
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

      {/* WEEK (view-only) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-indigo-600" />
            This Week’s Check-ins
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loadingWeek ? (
            <div className="text-muted-foreground py-8 text-center">Loading week check-ins…</div>
          ) : weekBookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No check-ins scheduled for this week.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weekBookings.map((b) => {
                const unitName = b.unit?.name ?? "Unit";
                const propertyName = b.unit?.property?.name;
                const title = propertyName ? `${propertyName} — ${unitName}` : unitName;

                return (
                  <div key={b.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{b.guestName || "Guest"}</p>
                        <p className="text-sm text-muted-foreground truncate mt-1">{title}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Check-in:{" "}
                          <span className="font-medium text-slate-700">
                            {new Date(b.checkIn).toLocaleString()}
                          </span>
                        </p>
                      </div>

                      <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium">
                        Status: <span className="ml-1 font-semibold">{b.status}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button disabled className="opacity-60">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Check-in
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Check-in is only available on the check-in date.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CHECK-IN MODAL */}
      <Dialog
        open={checkInOpen}
        onOpenChange={(open) => {
          setCheckInOpen(open);
          if (!open) {
            setSubmitAttempted(false);
            setUpdateGuestProfile(false);
            activeBookingIdRef.current = "";
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Check-in Guest</DialogTitle>
            <DialogDescription>
              Confirm stay details before check-in. Guest profile updates are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto pr-1 max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Guest Name</Label>
                <Input
                  value={checkInForm.guestName}
                  onChange={(e) => setCheckInForm((p) => ({ ...p, guestName: e.target.value }))}
                />
                {submitAttempted && guestNameError ? <p className="text-xs text-red-600">{guestNameError}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={checkInForm.guestPhone}
                  onChange={(e) => setCheckInForm((p) => ({ ...p, guestPhone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={checkInForm.guestEmail}
                onChange={(e) => setCheckInForm((p) => ({ ...p, guestEmail: e.target.value }))}
              />
              {submitAttempted && guestEmailError ? <p className="text-xs text-red-600">{guestEmailError}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nationality (optional)</Label>
                <Input
                  value={checkInForm.nationality}
                  onChange={(e) => setCheckInForm((p) => ({ ...p, nationality: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Plate (optional)</Label>
                <Input
                  value={checkInForm.vehiclePlate}
                  onChange={(e) => setCheckInForm((p) => ({ ...p, vehiclePlate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Input
                value={checkInForm.address}
                onChange={(e) => setCheckInForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-3">
              <p className="text-sm font-semibold">Identification</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>ID Type</Label>
                  <select
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-background"
                    value={checkInForm.idType}
                    onChange={(e) => setCheckInForm((p) => ({ ...p, idType: e.target.value }))}
                  >
                    <option value="NIN">NIN</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVERS_LICENSE">Driver’s License</option>
                    <option value="VOTERS_CARD">Voter’s Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>ID Number</Label>
                  <Input
                    value={checkInForm.idNumber}
                    onChange={(e) => setCheckInForm((p) => ({ ...p, idNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Issued By (optional)</Label>
                <Input
                  value={checkInForm.idIssuedBy}
                  onChange={(e) => setCheckInForm((p) => ({ ...p, idIssuedBy: e.target.value }))}
                />
              </div>
            </div>

<div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-3">
  <p className="text-sm font-semibold">Guest Photo</p>

  <div className="flex items-start gap-3">
    <div className="h-16 w-16 rounded-lg border bg-white overflow-hidden flex items-center justify-center shrink-0">
      {guestPhotoPreview ? (
        <img src={guestPhotoPreview} alt="Guest preview" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs text-muted-foreground">No photo</span>
      )}
    </div>

    <div className="flex-1 space-y-2">
      <input
        type="file"
        accept="image/*"
        capture="user"
        className="block w-full text-sm"
        onChange={(e) => handleGuestPhoto(e.target.files?.[0] ?? null)}
      />
      <p className="text-[11px] text-muted-foreground">
        Photo will be compressed to ≤ 300KB.
        {guestPhotoSize ? ` Current: ${(guestPhotoSize / 1024).toFixed(0)}KB` : ""}
      </p>

      {guestPhotoPreview ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setGuestPhotoBlob(null);
            setGuestPhotoPreview("");
            setGuestPhotoSize(0);
          }}
          className="h-8 px-3 text-xs"
        >
          Remove Photo
        </Button>
      ) : null}
    </div>
  </div>
</div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={checkInForm.notes}
                onChange={(e) => setCheckInForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Any special note for reception..."
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={updateGuestProfile}
                  disabled={!linkedGuestId}
                  onChange={(e) => setUpdateGuestProfile(e.target.checked)}
                />
                <span>
                  Also update Guest profile with these details
                  {!linkedGuestId ? (
                    <span className="block text-xs text-muted-foreground mt-1">
                      This booking is not linked to a Guest record, so profile update is unavailable.
                    </span>
                  ) : (
                    <span className="block text-xs text-muted-foreground mt-1">
                      If unchecked, only this stay record is updated.
                    </span>
                  )}
                </span>
              </label>
            </div>

            <Button onClick={submitCheckIn} disabled={!canSubmitCheckIn} className="w-full">
              {busyId === activeBooking?.id ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Checking in…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm Check-in
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
