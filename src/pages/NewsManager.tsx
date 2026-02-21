import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type NewsType = "ARTICLE" | "VIDEO" | "FEATURE" | "ANNOUNCEMENT";
type NewsStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type NewsItem = {
  id: string;
  title: string;
  slug: string;
  type: NewsType;
  status: NewsStatus;
  excerpt: string;
  content?: string | null;
  externalUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  isFeatured: boolean;
  publishedAt?: string | null;
  createdAt: string;
};

type NewsPayload = {
  title: string;
  slug: string;
  type: NewsType;
  status: NewsStatus;
  excerpt: string;
  content: string;
  externalUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  isFeatured: boolean;
};

const defaultPayload: NewsPayload = {
  title: "",
  slug: "",
  type: "ARTICLE",
  status: "DRAFT",
  excerpt: "",
  content: "",
  externalUrl: "",
  videoUrl: "",
  thumbnailUrl: "",
  isFeatured: false,
};

const typeOptions: NewsType[] = ["ARTICLE", "VIDEO", "FEATURE", "ANNOUNCEMENT"];
const statusOptions: NewsStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

function normalizeExternalUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function toDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function NewsManager() {
  const userRole = (localStorage.getItem("userRole") || "STAFF").toUpperCase();
  const isSuperAdmin = localStorage.getItem("isSuperAdmin") === "true";
  const tenantSlug = (localStorage.getItem("tenantSlug") || "").toLowerCase();
  const isAllowed = isSuperAdmin || (userRole === "ADMIN" && tenantSlug === "dtt-shortlet");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingDefaults, setImportingDefaults] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<NewsStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<NewsType | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState<NewsPayload>(defaultPayload);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  async function load() {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.set("page", "1");
      qs.set("pageSize", "100");
      if (search.trim()) qs.set("search", search.trim());
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      if (typeFilter !== "ALL") qs.set("type", typeFilter);

      const data = await apiFetch(`/api/news?${qs.toString()}`);
      setItems(Array.isArray(data?.news) ? data.news : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load news");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAllowed) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed, statusFilter, typeFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((x) => [x.title, x.slug, x.excerpt].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setForm(defaultPayload);
    setOpen(true);
  }

  function openEdit(item: NewsItem) {
    setEditing(item);
    setForm({
      title: item.title,
      slug: item.slug,
      type: item.type,
      status: item.status,
      excerpt: item.excerpt,
      content: item.content || "",
      externalUrl: item.externalUrl || "",
      videoUrl: item.videoUrl || "",
      thumbnailUrl: item.thumbnailUrl || "",
      isFeatured: item.isFeatured,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.excerpt.trim()) return toast.error("Excerpt is required");
    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        type: form.type,
        status: form.status,
        excerpt: form.excerpt.trim(),
        content: form.content.trim() || null,
        externalUrl: normalizeExternalUrl(form.externalUrl) || null,
        videoUrl: normalizeExternalUrl(form.videoUrl) || null,
        thumbnailUrl: normalizeExternalUrl(form.thumbnailUrl) || null,
        isFeatured: form.isFeatured,
      };
      if (editing) {
        await apiFetch(`/api/news/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("News item updated");
      } else {
        await apiFetch("/api/news", { method: "POST", body: JSON.stringify(payload) });
        toast.success("News item created");
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Delete this news item?")) return;
    try {
      setDeletingId(id);
      await apiFetch(`/api/news/${id}`, { method: "DELETE" });
      toast.success("News item deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setDeletingId("");
    }
  }

  async function importDefaults() {
    try {
      setImportingDefaults(true);
      const data = await apiFetch("/api/news/import-defaults", { method: "POST" });
      const created = Number(data?.created || 0);
      const skipped = Number(data?.skipped || 0);
      toast.success(`Import complete: ${created} created, ${skipped} already existed.`);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to import defaults");
    } finally {
      setImportingDefaults(false);
    }
  }

  function applyMarkdown(
    mode: "h2" | "bold" | "bullet" | "link" | "spacer" | "newline"
  ) {
    const el = contentRef.current;
    if (!el) return;
    const value = form.content || "";
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    let inserted = "";

    if (mode === "h2") inserted = `## ${selected || "Heading"}`;
    if (mode === "bold") inserted = `**${selected || "bold text"}**`;
    if (mode === "bullet") inserted = `- ${selected || "list item"}`;
    if (mode === "link") inserted = `[${selected || "link text"}](https://example.com)`;
    if (mode === "spacer") inserted = "\n\n";
    if (mode === "newline") inserted = "\n";

    const next = `${value.slice(0, start)}${inserted}${value.slice(end)}`;
    setForm((p) => ({ ...p, content: next }));

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + inserted.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  if (!isAllowed) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">News Management</h1>
        <p className="text-sm text-slate-600">
          Only SuperAdmin or DTT Properties Admin can manage public news content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">News Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={importDefaults} disabled={importingDefaults}>
            {importingDefaults ? "Importing..." : "Import default content"}
          </Button>
          <Button onClick={openCreate}>Add News</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Search title, slug, excerpt" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter((e.target.value as NewsType | "ALL") || "ALL")}
          >
            <option value="ALL">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value as NewsStatus | "ALL") || "ALL")}
          >
            <option value="ALL">All status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No news items found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.type} • {item.status} • slug: {item.slug}
                      </p>
                      <p className="text-sm text-slate-700">{item.excerpt}</p>
                      <p className="text-xs text-slate-500">Published: {toDate(item.publishedAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => openEdit(item)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => removeItem(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit News Item" : "Create News Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Slug (optional)</Label>
              <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as NewsType }))}
                >
                  {typeOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as NewsStatus }))}
                >
                  {statusOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Excerpt</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.excerpt}
                onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Content (optional)</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyMarkdown("h2")}>
                  H2
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyMarkdown("bold")}>
                  Bold
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyMarkdown("bullet")}>
                  Bullet
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyMarkdown("link")}>
                  Link
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyMarkdown("spacer")}>
                  Spacer
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyMarkdown("newline")}>
                  New line
                </Button>
              </div>
              <textarea
                ref={contentRef}
                className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              />
              <p className="text-xs text-slate-500">
                Supports Markdown: <code># Heading</code>, <code>## Subheading</code>, <code>- bullet</code>,{" "}
                <code>**bold**</code>, <code>*italic*</code>, <code>[text](https://...)</code>.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Preview</Label>
              <div
                className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 [&_.md-spacer]:h-3 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-indigo-700 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) || "<p>No content yet.</p>" }}
              />
            </div>
            <div className="space-y-1">
              <Label>External URL (optional)</Label>
              <Input value={form.externalUrl} onChange={(e) => setForm((p) => ({ ...p, externalUrl: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Video URL (optional)</Label>
              <Input value={form.videoUrl} onChange={(e) => setForm((p) => ({ ...p, videoUrl: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Thumbnail URL (optional)</Label>
              <Input
                value={form.thumbnailUrl}
                onChange={(e) => setForm((p) => ({ ...p, thumbnailUrl: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm((p) => ({ ...p, isFeatured: e.target.checked }))}
              />
              Feature this item on top
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
