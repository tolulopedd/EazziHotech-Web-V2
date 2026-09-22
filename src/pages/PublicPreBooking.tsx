import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, Hotel, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publicFetch } from "@/lib/api";

type Workspace = { name: string; slug: string; address?: string | null; phone?: string | null; email?: string | null };

function lagosDateKey(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function PublicPreBooking() {
  const { token = "" } = useParams();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successReference, setSuccessReference] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", plannedCheckIn: lagosDateKey(), plannedCheckOut: lagosDateKey(1), notes: "", website: "" });
  const minCheckOut = useMemo(() => {
    const checkIn = new Date(`${form.plannedCheckIn}T12:00:00`);
    if (Number.isNaN(checkIn.getTime())) return lagosDateKey(1);
    checkIn.setDate(checkIn.getDate() + 1);
    return checkIn.toISOString().slice(0, 10);
  }, [form.plannedCheckIn]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await publicFetch(`/api/public/pre-book/${encodeURIComponent(token)}`);
        if (!cancelled) setWorkspace(data.workspace as Workspace);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "This pre-booking link is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!form.fullName.trim() || !form.phone.trim() || !form.plannedCheckIn || !form.plannedCheckOut) {
      setError("Enter your name, phone number, and planned stay dates.");
      return;
    }
    if (form.plannedCheckOut <= form.plannedCheckIn) {
      setError("Check-out must be after check-in.");
      return;
    }
    try {
      setSubmitting(true);
      const data = await publicFetch(`/api/public/pre-book/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify(form) });
      setSuccessReference(data.reference || "");
    } catch (e: any) {
      setError(e?.message || "Unable to submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <Hotel className="h-5 w-5" /> EazziHotech
        </Link>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {loading ? <div className="flex min-h-64 items-center justify-center text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading pre-booking form...</div> : null}
          {!loading && error && !workspace ? <div className="py-12 text-center"><h1 className="text-xl font-bold text-slate-900">Link unavailable</h1><p className="mt-2 text-slate-600">{error}</p></div> : null}
          {!loading && workspace && successReference ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h1 className="mt-4 text-2xl font-bold text-slate-950">Request received</h1>
              <p className="mt-3 text-slate-600">Your pre-booking reference is <strong>{successReference}</strong>. {workspace.name} will contact you to confirm room assignment and payment.</p>
            </div>
          ) : null}
          {!loading && workspace && !successReference ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{workspace.name}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Request a pre-booking</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">Send your preferred stay dates and contact details. The property team will confirm room assignment and payment with you.</p>
              {workspace.address || workspace.phone ? <p className="mt-3 text-sm text-slate-500">{[workspace.address, workspace.phone].filter(Boolean).join(" • ")}</p> : null}
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2"><Label htmlFor="fullName">Full name</Label><Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" required /></div>
                  <div className="space-y-2"><Label htmlFor="phone">Phone number</Label><Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" required /></div>
                  <div className="space-y-2"><Label htmlFor="email">Email <span className="text-slate-400">(optional)</span></Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></div>
                  <div className="space-y-2"><Label htmlFor="checkIn">Planned check-in</Label><Input id="checkIn" type="date" min={lagosDateKey()} value={form.plannedCheckIn} onChange={(e) => setForm({ ...form, plannedCheckIn: e.target.value, plannedCheckOut: e.target.value >= form.plannedCheckOut ? "" : form.plannedCheckOut })} required /></div>
                  <div className="space-y-2"><Label htmlFor="checkOut">Planned check-out</Label><Input id="checkOut" type="date" min={minCheckOut} value={form.plannedCheckOut} onChange={(e) => setForm({ ...form, plannedCheckOut: e.target.value })} required /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="notes">Special requests <span className="text-slate-400">(optional)</span></Label><Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="For example: number of guests, late arrival, or other requests" /></div>
                <div className="hidden" aria-hidden="true"><Label htmlFor="website">Website</Label><Input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button className="w-full" type="submit" disabled={submitting}><CalendarDays className="mr-2 h-4 w-4" />{submitting ? "Submitting request..." : "Submit Pre-Booking Request"}</Button>
              </form>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
