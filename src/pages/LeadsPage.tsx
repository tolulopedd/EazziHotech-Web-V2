import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
type Lead = {
  id: string;
  companyName: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
  businessType?: string | null;
  message?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  contactSourceUrl?: string | null;
  leadType?: "INBOUND" | "OUTBOUND" | string;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  roomCount?: number | null;
  verificationStatus?: "NOT_REQUIRED" | "PENDING" | "VERIFIED" | string;
  contactVerifiedAt?: string | null;
  introEmailSentAt?: string | null;
  introEmailSubject?: string | null;
  status: LeadStatus;
  assignedTo?: string | null;
  notes?: string | null;
  contactedAt?: string | null;
  createdAt: string;
};

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];
type StatusSummary = Record<LeadStatus, number>;
type LeadSummary = { inboundCount: number; outboundCount: number; pendingVerificationCount: number };
type IntroductionPreview = { to: string; subject: string; html: string; alreadySentAt?: string | null };

const DEFAULT_STATUS_SUMMARY: StatusSummary = {
  NEW: 0,
  CONTACTED: 0,
  QUALIFIED: 0,
  WON: 0,
  LOST: 0,
};

export default function LeadsPage() {
  const isSuperAdmin = localStorage.getItem("isSuperAdmin") === "true";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary>(DEFAULT_STATUS_SUMMARY);
  const [leadSummary, setLeadSummary] = useState<LeadSummary>({ inboundCount: 0, outboundCount: 0, pendingVerificationCount: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");
  const [leadTypeFilter, setLeadTypeFilter] = useState<"ALL" | "INBOUND" | "OUTBOUND">("ALL");
  const [stateFilter, setStateFilter] = useState<"ALL" | "Lagos" | "Ogun">("ALL");
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "hotels.ng" | "landing-page" | "manual">("ALL");
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState<LeadStatus>("NEW");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editContactVerified, setEditContactVerified] = useState(false);
  const [introPreview, setIntroPreview] = useState<IntroductionPreview | null>(null);
  const [previewingIntro, setPreviewingIntro] = useState(false);
  const [sendingIntro, setSendingIntro] = useState(false);

  async function loadLeads() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (leadTypeFilter !== "ALL") params.set("leadType", leadTypeFilter);
      if (stateFilter !== "ALL") params.set("state", stateFilter);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const data = await apiFetch(`/api/leads?${params.toString()}`);
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
      setTotal(Number(data?.total ?? 0));
      setTotalPages(Math.max(1, Number(data?.totalPages ?? 1)));
      setStatusSummary((data?.statusSummary ?? DEFAULT_STATUS_SUMMARY) as StatusSummary);
      setLeadSummary((data?.summary ?? { inboundCount: 0, outboundCount: 0, pendingVerificationCount: 0 }) as LeadSummary);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, page, pageSize]);

  function openLead(lead: Lead) {
    setSelected(lead);
    setEditStatus(lead.status);
    setEditAssignedTo(lead.assignedTo || "");
    setEditNotes(lead.notes || "");
    setEditContactName(lead.contactName || "");
    setEditEmail(lead.email || "");
    setEditPhone(lead.phone || "");
    setEditContactVerified(lead.verificationStatus === "VERIFIED");
    setIntroPreview(null);
  }

  async function saveLead() {
    if (!selected) return;
    try {
      setSaving(true);
      const data = await apiFetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editStatus,
          contactName: editContactName.trim() || "Management / Owner",
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          contactVerified: editContactVerified,
          assignedTo: editAssignedTo.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });
      const updated = data?.lead as Lead;
      setLeads((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSelected(updated);
      toast.success("Lead updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update lead");
    } finally {
      setSaving(false);
    }
  }

  async function importHotelsNg() {
    const confirmed = window.confirm(
      "Import the reviewed Lagos and Ogun Hotels.ng prospects? They will be marked contact verification pending."
    );
    if (!confirmed) return;
    try {
      setImporting(true);
      const data = await apiFetch("/api/leads/import/hotels-ng", { method: "POST" });
      toast.success(data?.message || "Hotels.ng prospects imported.");
      setPage(1);
      await loadLeads();
    } catch (err: any) {
      toast.error(err?.message || "Failed to import Hotels.ng prospects");
    } finally {
      setImporting(false);
    }
  }

  async function previewIntroduction() {
    if (!selected) return;
    try {
      setPreviewingIntro(true);
      const data = await apiFetch(`/api/leads/${selected.id}/introduction-preview`);
      setIntroPreview(data as IntroductionPreview);
    } catch (err: any) {
      toast.error(err?.message || "Unable to prepare the email preview");
    } finally {
      setPreviewingIntro(false);
    }
  }

  async function sendIntroduction() {
    if (!selected || !introPreview) return;
    const confirmed = window.confirm(`Send this one-time introduction to ${introPreview.to}? This cannot be sent again from this lead.`);
    if (!confirmed) return;
    try {
      setSendingIntro(true);
      const data = await apiFetch(`/api/leads/${selected.id}/send-introduction`, { method: "POST" });
      const updated = data?.lead as Lead;
      setLeads((prev) => prev.map((lead) => (lead.id === updated.id ? updated : lead)));
      setSelected(updated);
      setIntroPreview(null);
      toast.success(data?.message || "Introduction email sent");
    } catch (err: any) {
      toast.error(err?.message || "Unable to send introduction email");
    } finally {
      setSendingIntro(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">Only platform Super Admin can access lead management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-2">Qualify inbound requests and manage verified hospitality prospects for sales outreach.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Lead Pipeline</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Directory imports keep source data separate from verified owner contact details.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadLeads} disabled={loading || saving || importing}>
              Refresh
            </Button>
            <Button onClick={importHotelsNg} disabled={loading || saving || importing}>
              {importing ? "Importing..." : "Import Hotels.ng Prospects"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            {STATUSES.map((s) => (
              <div key={s} className="rounded-lg border bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">{s}</div>
                <div className="text-xl font-semibold">{statusSummary[s] ?? 0}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
              <div className="text-xs text-indigo-700">Inbound demo requests</div>
              <div className="text-xl font-semibold text-indigo-950">{leadSummary.inboundCount}</div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <div className="text-xs text-emerald-700">Outbound prospects</div>
              <div className="text-xl font-semibold text-emerald-950">{leadSummary.outboundCount}</div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <div className="text-xs text-amber-700">Contact verification pending</div>
              <div className="text-xl font-semibold text-amber-950">{leadSummary.pendingVerificationCount}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <Input
              placeholder="Search company, contact, email, phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "ALL")}
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={leadTypeFilter}
              onChange={(e) => setLeadTypeFilter(e.target.value as typeof leadTypeFilter)}
            >
              <option value="ALL">All lead types</option>
              <option value="INBOUND">Inbound requests</option>
              <option value="OUTBOUND">Outbound prospects</option>
            </select>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
            >
              <option value="ALL">All locations</option>
              <option value="Lagos">Lagos</option>
              <option value="Ogun">Ogun</option>
            </select>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
            >
              <option value="ALL">All sources</option>
              <option value="hotels.ng">Hotels.ng</option>
              <option value="landing-page">Landing page</option>
              <option value="manual">Manual</option>
            </select>
            <Button
              onClick={() => {
                if (page === 1) loadLeads();
                else setPage(1);
              }}
              disabled={loading}
            >
              Apply
            </Button>
          </div>

          <div className="hidden overflow-hidden rounded-lg border md:block">
            <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-medium text-muted-foreground">
              <div className="col-span-3">Company</div>
              <div className="col-span-2">Contact</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading leads...</div>
            ) : leads.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No leads found.</div>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="grid grid-cols-12 items-center border-t px-4 py-3">
                  <div className="col-span-3">
                    <div className="font-medium">{lead.companyName}</div>
                    <div className="text-xs text-muted-foreground">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : new Date(lead.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="col-span-2 text-sm">{lead.roomCount !== null && lead.roomCount !== undefined ? `${lead.roomCount} listed rooms` : lead.contactName}</div>
                  <div className="col-span-2 text-sm">{lead.status}</div>
                  <div className="col-span-3 text-sm">{lead.email || (lead.verificationStatus === "PENDING" ? "Contact verification pending" : "No email maintained")}</div>
                  <div className="col-span-2 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => openLead(lead)}>
                      Manage
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 md:hidden">
            {loading ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading leads...</div>
            ) : leads.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">No leads found.</div>
            ) : (
              leads.map((lead) => (
                <article key={lead.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">{lead.companyName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.businessType || "Hospitality business"}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{lead.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Type:</span> {lead.businessType || lead.leadType || "-"}</div>
                    <div><span className="text-muted-foreground">Rooms:</span> {lead.roomCount ?? "-"}</div>
                    <div className="col-span-2 truncate"><span className="text-muted-foreground">Contact:</span> {lead.email || lead.phone || "Verification pending"}</div>
                  </div>
                  <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => openLead(lead)}>Manage Lead</Button>
                </article>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Showing page {page} of {totalPages} • {total} total lead{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                value={String(pageSize)}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setPageSize(next);
                  setPage(1);
                }}
              >
                {[10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} / page
                  </option>
                ))}
              </select>
              <Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Lead Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div>
                <span className="text-muted-foreground">Company:</span> {selected.companyName}
              </div>
              <div>
                <span className="text-muted-foreground">Contact:</span> {selected.contactName}
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span> {selected.email || "Not maintained"}
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span> {selected.phone || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Business Type:</span> {selected.businessType || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Source:</span> {selected.source || "landing-page"}
              </div>
              <div>
                <span className="text-muted-foreground">Lead Type:</span> {selected.leadType || "INBOUND"}
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span> {[selected.city, selected.state].filter(Boolean).join(", ") || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Directory-listed rooms:</span> {selected.roomCount ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Contact verification:</span> {selected.verificationStatus === "VERIFIED" ? "Verified" : selected.verificationStatus === "PENDING" ? "Pending" : "Not required"}
              </div>
            </div>

            {selected.address ? (
              <div className="space-y-1 text-sm">
                <span className="text-muted-foreground">Address:</span> {selected.address}
              </div>
            ) : null}

            {selected.sourceUrl ? (
              <a className="inline-flex text-sm font-medium text-indigo-700 underline underline-offset-2" href={selected.sourceUrl} target="_blank" rel="noreferrer">
                Open source listing
              </a>
            ) : null}

            {selected.contactSourceUrl ? (
              <a className="ml-4 inline-flex text-sm font-medium text-indigo-700 underline underline-offset-2" href={selected.contactSourceUrl} target="_blank" rel="noreferrer">
                Open public contact source
              </a>
            ) : null}

            {selected.leadType === "OUTBOUND" ? (
              <section className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
                <div>
                  <h3 className="font-semibold text-indigo-950">One-Time Introduction Email</h3>
                  <p className="mt-1 text-sm text-indigo-900">Preview the EazziHotech introduction before sending it to this verified business contact.</p>
                </div>
                {selected.introEmailSentAt ? (
                  <p className="text-sm text-emerald-800">Sent on {new Date(selected.introEmailSentAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}{selected.introEmailSubject ? `: ${selected.introEmailSubject}` : ""}</p>
                ) : !selected.email ? (
                  <p className="text-sm text-amber-800">Lead email is not maintained. Add and verify a direct business email before sending.</p>
                ) : selected.verificationStatus !== "VERIFIED" ? (
                  <p className="text-sm text-amber-800">Verify the lead's direct business email before sending an introduction.</p>
                ) : (
                  <Button type="button" variant="outline" onClick={previewIntroduction} disabled={previewingIntro || saving}>
                    {previewingIntro ? "Preparing Preview..." : "Preview Introduction Email"}
                  </Button>
                )}
                {introPreview ? (
                  <div className="space-y-3 rounded-md border bg-white p-3">
                    <div className="text-sm"><span className="font-medium">To:</span> {introPreview.to}</div>
                    <div className="text-sm"><span className="font-medium">Subject:</span> {introPreview.subject}</div>
                    <iframe title="Introduction email preview" sandbox="" className="h-[420px] w-full rounded border bg-white" srcDoc={introPreview.html} />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={sendIntroduction} disabled={sendingIntro}>
                        {sendingIntro ? "Sending..." : "Confirm & Send Introduction"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIntroPreview(null)} disabled={sendingIntro}>Close Preview</Button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="space-y-2">
              <Label>Message</Label>
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm min-h-[70px]">{selected.message || "—"}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Input value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)} placeholder="Sales owner name" />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} placeholder="Owner, manager, or reception" />
              </div>
              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Verified business email" />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Verified direct phone" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Public Contact Source</Label>
                <Input
                  value={selected.contactSourceUrl || ""}
                  readOnly
                  placeholder="No public contact source recorded"
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Qualification notes"
                  rows={4}
                />
              </div>
            </div>

            {selected.leadType === "OUTBOUND" ? (
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={editContactVerified}
                  onChange={(e) => setEditContactVerified(e.target.checked)}
                />
                <span>
                  I have verified this property’s direct contact details and room inventory.
                  <span className="mt-1 block text-xs text-amber-800">Do not mark this until the team has confirmed it directly with the property.</span>
                </span>
              </label>
            ) : null}

            <div className="flex items-center gap-2">
              <Button onClick={saveLead} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
