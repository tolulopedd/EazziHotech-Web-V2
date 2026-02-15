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
  email: string;
  phone?: string | null;
  businessType?: string | null;
  message?: string | null;
  source?: string | null;
  status: LeadStatus;
  assignedTo?: string | null;
  notes?: string | null;
  contactedAt?: string | null;
  createdAt: string;
};

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];
type StatusSummary = Record<LeadStatus, number>;

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
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("ALL");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState<LeadStatus>("NEW");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editNotes, setEditNotes] = useState("");

  async function loadLeads() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const data = await apiFetch(`/api/leads?${params.toString()}`);
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
      setTotal(Number(data?.total ?? 0));
      setTotalPages(Math.max(1, Number(data?.totalPages ?? 1)));
      setStatusSummary((data?.statusSummary ?? DEFAULT_STATUS_SUMMARY) as StatusSummary);
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
  }

  async function saveLead() {
    if (!selected) return;
    try {
      setSaving(true);
      const data = await apiFetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editStatus,
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
        <p className="text-muted-foreground mt-2">Manage public demo requests and update lead status.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Lead Pipeline</CardTitle>
          <Button variant="outline" onClick={loadLeads} disabled={loading || saving}>
            Refresh
          </Button>
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

          <div className="grid gap-3 md:grid-cols-3">
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

          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-50 text-xs font-medium text-muted-foreground px-4 py-3">
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
                <div key={lead.id} className="grid grid-cols-12 border-t px-4 py-3 items-center">
                  <div className="col-span-3">
                    <div className="font-medium">{lead.companyName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="col-span-2 text-sm">{lead.contactName}</div>
                  <div className="col-span-2 text-sm">{lead.status}</div>
                  <div className="col-span-3 text-sm">{lead.email}</div>
                  <div className="col-span-2 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => openLead(lead)}>
                      Manage
                    </Button>
                  </div>
                </div>
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
                <span className="text-muted-foreground">Email:</span> {selected.email}
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
            </div>

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
