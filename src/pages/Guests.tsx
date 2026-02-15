// src/pages/Guests.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Search, UserRound } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Guest = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;

  address?: string | null;
  nationality?: string | null;

  idType?: string | null;
  idNumber?: string | null;
  idIssuedBy?: string | null;

  createdAt?: string;
};

function initials(name?: string) {
  const n = (name || "").trim();
  if (!n) return "G";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "G";
}

const idTypeLabelMap: Record<string, string> = {
  NIN: "NIN",
  PASSPORT: "Passport",
  DRIVERS_LICENSE: "Driver’s License",
  VOTERS_CARD: "Voter’s Card",
  OTHER: "Other",
};

export default function Guests() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);

  // Create guest dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    nationality: "",
    idType: "NIN",
    idNumber: "",
    idIssuedBy: "",
  });

  // Details modal
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);

  async function fetchGuests(q?: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      const value = (q ?? query).trim();
      if (value) qs.set("q", value);

      const data = await apiFetch(`/api/guests${qs.toString() ? `?${qs.toString()}` : ""}`);
      setGuests((data?.guests || []) as Guest[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load guests");
      setGuests([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGuestById(id: string) {
    try {
      setActiveLoading(true);
      const data = await apiFetch(`/api/guests/${id}`);
      const g = (data?.guest ?? data) as Guest;
      setActiveGuest(g);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load guest details");
      setActiveGuest(null);
    } finally {
      setActiveLoading(false);
    }
  }

  useEffect(() => {
    fetchGuests("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => {
      const s = `${g.fullName} ${g.email || ""} ${g.phone || ""} ${g.idType || ""} ${g.idNumber || ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [guests, query]);

  async function createGuest() {
    const fullName = form.fullName.trim();
    if (!fullName) {
      toast.error("Full name is required");
      return;
    }

    try {
      setBusy(true);

      const payload = {
        fullName,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        nationality: form.nationality.trim() || null,
        idType: form.idType || null,
        idNumber: form.idNumber.trim() || null,
        idIssuedBy: form.idIssuedBy.trim() || null,
      };

      const res = await apiFetch("/api/guests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Guest created");
      setOpenCreate(false);

      setForm({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        nationality: "",
        idType: "NIN",
        idNumber: "",
        idIssuedBy: "",
      });

      await fetchGuests(query);

      const createdId = res?.guest?.id || res?.id;
      if (createdId) {
        await fetchGuestById(createdId); // ✅ load full details for modal
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create guest");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guests</h1>
          <p className="text-muted-foreground mt-2">
            Manage guest profiles and reuse guest information for bookings and check-in.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchGuests(query)} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>

          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Guest
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Guest</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Email (optional)</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone (optional)</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="+234..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nationality (optional)</Label>
                    <Input
                      value={form.nationality}
                      onChange={(e) => setForm((s) => ({ ...s, nationality: e.target.value }))}
                      placeholder="Nigerian"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Address (optional)</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                      placeholder="Home address..."
                    />
                  </div>
                </div>

                {/* ID Details (create) */}
                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-3">
                  <p className="text-sm font-semibold">Identification</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>ID Type</Label>
                      <select
                        className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-background"
                        value={form.idType}
                        onChange={(e) => setForm((p) => ({ ...p, idType: e.target.value }))}
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
                        value={form.idNumber}
                        onChange={(e) => setForm((p) => ({ ...p, idNumber: e.target.value }))}
                        placeholder="NIN / Passport / Driver's License..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Issued By (optional)</Label>
                    <Input
                      value={form.idIssuedBy}
                      onChange={(e) => setForm((p) => ({ ...p, idIssuedBy: e.target.value }))}
                      placeholder="FRSC / NIMC / Immigration..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={createGuest} disabled={busy}>
                    {busy ? "Creating..." : "Create Guest"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, email, phone, ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchGuests(query);
                }}
              />
            </div>

            <Button onClick={() => fetchGuests(query)} disabled={loading}>
              Search
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                fetchGuests("");
              }}
              disabled={loading && !query}
            >
              Clear
            </Button>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm">
              Total: <span className="font-semibold text-indigo-700">{filtered.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserRound className="h-5 w-5 text-indigo-600" />
            Guest List
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-200 mx-auto" />
                <p className="text-muted-foreground">Loading guests…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <UserRound className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No guests found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((g) => (
                <button
                  key={g.id}
                  onClick={() => fetchGuestById(g.id)} // ✅ fetch full details on open
                  className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl border bg-indigo-50 flex items-center justify-center text-sm font-semibold text-indigo-700 shrink-0">
                      {initials(g.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{g.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(g.email || "—")} • {(g.phone || "—")}
                      </p>
                      {(g.idType || g.idNumber) ? (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          ID: {idTypeLabelMap[String(g.idType || "")] || g.idType || "—"} • {g.idNumber || "—"}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground shrink-0">
                    <span className="font-mono">{g.id.slice(24, 36)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details / Edit Modal */}
      <Dialog open={!!activeGuest || activeLoading} onOpenChange={(o) => !o && setActiveGuest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Guest Details</DialogTitle>
          </DialogHeader>

          {activeLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading guest details…
            </div>
          ) : activeGuest ? (
            <GuestDetails
              guest={activeGuest}
              onClose={() => setActiveGuest(null)}
              onUpdated={async (g) => {
                // ✅ re-fetch full guest (ensures modal always has complete fields)
                await fetchGuestById(g.id);
                await fetchGuests(query);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================
   Guest Details (View + Edit)
========================= */

function GuestDetails({
  guest,
  onClose,
  onUpdated,
}: {
  guest: Guest;
  onClose: () => void;
  onUpdated: (g: Guest) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: guest.fullName || "",
    email: guest.email || "",
    phone: guest.phone || "",
    nationality: guest.nationality || "",
    address: guest.address || "",
    idType: guest.idType || "NIN",
    idNumber: guest.idNumber || "",
    idIssuedBy: guest.idIssuedBy || "",
  });

  useEffect(() => {
    setEditMode(false);
    setForm({
      fullName: guest.fullName || "",
      email: guest.email || "",
      phone: guest.phone || "",
      nationality: guest.nationality || "",
      address: guest.address || "",
      idType: guest.idType || "NIN",
      idNumber: guest.idNumber || "",
      idIssuedBy: guest.idIssuedBy || "",
    });
  }, [guest.id]);

  async function save() {
    const fullName = form.fullName.trim();
    if (!fullName) {
      toast.error("Full name is required");
      return;
    }

    try {
      setSaving(true);

      const res = await apiFetch(`/api/guests/${guest.id}`, {
        method: "PUT",
        body: JSON.stringify({
          fullName,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          nationality: form.nationality.trim() || null,
          address: form.address.trim() || null,
          idType: form.idType || null,
          idNumber: form.idNumber.trim() || null,
          idIssuedBy: form.idIssuedBy.trim() || null,
        }),
      });

      toast.success("Guest updated");
      setEditMode(false);

      const updated = (res?.guest ?? res) as Guest;
      onUpdated(updated);
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditMode(false);
    setForm({
      fullName: guest.fullName || "",
      email: guest.email || "",
      phone: guest.phone || "",
      nationality: guest.nationality || "",
      address: guest.address || "",
      idType: guest.idType || "NIN",
      idNumber: guest.idNumber || "",
      idIssuedBy: guest.idIssuedBy || "",
    });
  }

  return (
    <div className="space-y-4">
      {!editMode ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Full Name</p>
              <p className="font-semibold">{guest.fullName || "—"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-slate-900">{guest.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium text-slate-900">{guest.phone || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Nationality</p>
                <p className="text-sm font-medium text-slate-900">{guest.nationality || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium text-slate-900 truncate">{guest.address || "—"}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
              <p className="text-sm font-semibold">Identification</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">ID Type</p>
                  <p className="text-sm font-medium text-slate-900">
                    {idTypeLabelMap[String(guest.idType || "")] || guest.idType || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">ID Number</p>
                  <p className="text-sm font-medium text-slate-900">{guest.idNumber || "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Issued By</p>
                <p className="text-sm font-medium text-slate-900">{guest.idIssuedBy || "—"}</p>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs text-muted-foreground">Guest ID</p>
              <p className="text-xs font-mono text-slate-700">{guest.id}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => setEditMode(true)}>Edit Guest</Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="+234..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                placeholder="Home address..."
              />
            </div>

            <div className="space-y-2">
              <Label>Nationality (optional)</Label>
              <Input
                value={form.nationality}
                onChange={(e) => setForm((s) => ({ ...s, nationality: e.target.value }))}
                placeholder="Nigerian"
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-3">
              <p className="text-sm font-semibold">Identification</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>ID Type</Label>
                  <select
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg bg-background"
                    value={form.idType}
                    onChange={(e) => setForm((p) => ({ ...p, idType: e.target.value }))}
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
                    value={form.idNumber}
                    onChange={(e) => setForm((p) => ({ ...p, idNumber: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Issued By (optional)</Label>
                <Input
                  value={form.idIssuedBy}
                  onChange={(e) => setForm((p) => ({ ...p, idIssuedBy: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}