import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, RefreshCcw, Download } from "lucide-react";
import { formatNaira } from "@/lib/currency";
import { formatDateLagos, formatInteger } from "@/lib/format";

type ReportRange = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";
type ReportTab = "OVERVIEW" | "REVENUE" | "OUTSTANDING" | "OCCUPANCY" | "REFUNDS" | "DAMAGES";

type Property = {
  id: string;
  name: string;
};

type ReportResponse = {
  range: { from: string; to: string };
  summary: {
    bookingsCount: number;
    checkedInCount: number;
    totalBookingAmount: string;
    totalPaid: string;
    outstanding: string;
    currency: string;
    earlyCheckoutCount: number;
    refundApprovedCount: number;
    refundEligibleTotal: string;
    refundAmountTotal: string;
    overstayCount: number;
    overstayAmountTotal: string;
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
    damagesCount: number;
    damagesAmountTotal: string;
  };
  daily: Array<{
    day: string;
    bookingsCreated: number;
    checkIns: number;
    totalBookingAmount: number;
    totalPaid: number;
    outstanding: number;
  }>;
  topOutstanding: Array<{
    bookingId: string;
    guestName?: string | null;
    propertyName?: string | null;
    unitName?: string | null;
    status: string;
    paymentStatus: string;
    totalAmount: string;
    paidTotal: string;
    outstanding: string;
    currency: string;
    createdAt?: string;
  }>;
  earlyCheckouts: Array<{
    checkEventId: string;
    bookingId: string;
    guestName?: string | null;
    propertyName?: string | null;
    unitName?: string | null;
    checkedOutAt: string;
    refundPolicy?: string | null;
    refundEligibleAmount: string;
    refundApproved: boolean;
    refundAmount: string;
    refundStatus?: string | null;
    refundReason?: string | null;
  }>;
  overstays: Array<{
    bookingId: string;
    guestName?: string | null;
    propertyName?: string | null;
    unitName?: string | null;
    scheduledCheckout: string;
    daysOverstayed: number;
    estimatedOverstay: string;
    postedOverstay: string;
    currency: string;
  }>;
  damages: Array<{
    chargeId: string;
    bookingId: string;
    title: string;
    amount: string;
    currency: string;
    createdAt: string;
    guestName?: string | null;
    propertyName?: string | null;
    unitName?: string | null;
  }>;
};

function toISODate(d: Date) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

type EnvMeta = {
  env?: {
    VITE_API_BASE_URL?: string;
    VITE_API_URL?: string;
  };
};

function getErrorMessage(e: unknown, fallback: string) {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function getApiBase() {
  const meta = import.meta as EnvMeta;
  const v =
    meta?.env?.VITE_API_BASE_URL ||
    meta?.env?.VITE_API_URL;
  return v ? String(v).replace(/\/$/, "") : "";
}

function getAuthHeaders() {
  // Adjust these keys if your app stores token differently
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    "";

  // Adjust these keys if your app stores tenant differently
  const tenantId =
    localStorage.getItem("tenantId") ||
    localStorage.getItem("x-tenant-id") ||
    "";

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "x-tenant-id": tenantId } : {}),
  };
}

async function downloadCsv(pathWithQuery: string, filename: string) {
  const base = getApiBase();
  const url = `${base}${pathWithQuery}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Export failed");
  }

  const blob = await res.blob();
  const href = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(href);
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("OVERVIEW");
  const [range, setRange] = useState<ReportRange>("MONTH");
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return toISODate(d);
  });
  const [to, setTo] = useState<string>(() => toISODate(new Date()));

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>(""); // "" = all properties

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<"DAILY" | "OUTSTANDING" | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ReportResponse | null>(null);

  const outstandingAging = useMemo(() => {
    if (!report) return { a0to7: 0, a8to30: 0, a31plus: 0 };

    return report.topOutstanding.reduce(
      (acc, row) => {
        const created = row.createdAt ? new Date(`${row.createdAt}T00:00:00`) : null;
        if (!created || Number.isNaN(created.getTime())) return acc;
        const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));
        const value = Number(row.outstanding ?? 0);
        if (!Number.isFinite(value) || value <= 0) return acc;
        if (days <= 7) acc.a0to7 += value;
        else if (days <= 30) acc.a8to30 += value;
        else acc.a31plus += value;
        return acc;
      },
      { a0to7: 0, a8to30: 0, a31plus: 0 }
    );
  }, [report]);

  const effective = useMemo(() => {
    const now = new Date();
    if (range === "TODAY") {
      const d = toISODate(now);
      return { from: d, to: d };
    }
    if (range === "WEEK") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { from: toISODate(start), to: toISODate(now) };
    }
    if (range === "MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toISODate(start), to: toISODate(now) };
    }
    return { from, to };
  }, [range, from, to]);

  async function loadProperties() {
    try {
      const data = await apiFetch("/api/properties");
      setProperties((data?.properties ?? []) as Property[]);
    } catch {
      setProperties([]);
    }
  }

  async function loadReport() {
    setError("");
    setLoading(true);
    try {
      const qs =
        `?from=${encodeURIComponent(effective.from)}` +
        `&to=${encodeURIComponent(effective.to)}` +
        (propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : "");

      const data = await apiFetch(`/api/reports/bookings-payments${qs}`);
      setReport(data as ReportResponse);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load report"));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function exportDailyCsv() {
    setError("");
    setDownloading("DAILY");
    try {
      const qs =
        `?from=${encodeURIComponent(effective.from)}` +
        `&to=${encodeURIComponent(effective.to)}` +
        (propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : "");

      await downloadCsv(
        `/api/reports/bookings-payments/daily.csv${qs}`,
        `bookings-payments-daily_${effective.from}_${effective.to}${propertyId ? `_property-${propertyId}` : ""}.csv`
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to export daily CSV"));
    } finally {
      setDownloading(null);
    }
  }

  async function exportOutstandingCsv() {
    setError("");
    setDownloading("OUTSTANDING");
    try {
      const qs =
        `?from=${encodeURIComponent(effective.from)}` +
        `&to=${encodeURIComponent(effective.to)}` +
        (propertyId ? `&propertyId=${encodeURIComponent(propertyId)}` : "");

      await downloadCsv(
        `/api/reports/bookings-payments/outstanding.csv${qs}`,
        `outstanding-bookings_${effective.from}_${effective.to}${propertyId ? `_property-${propertyId}` : ""}.csv`
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to export outstanding CSV"));
    } finally {
      setDownloading(null);
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective.from, effective.to, range, propertyId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-2">Bookings and payments performance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadReport} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button variant="outline" onClick={exportDailyCsv} disabled={loading || downloading !== null}>
            <Download className="mr-2 h-4 w-4" />
            {downloading === "DAILY" ? "Exporting..." : "Export Daily CSV"}
          </Button>

          <Button variant="outline" onClick={exportOutstandingCsv} disabled={loading || downloading !== null}>
            <Download className="mr-2 h-4 w-4" />
            {downloading === "OUTSTANDING" ? "Exporting..." : "Export Outstanding CSV"}
          </Button>
        </div>
      </div>

      {/* Filters */}
{/* Filters */}
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle className="text-lg flex items-center gap-2">
      <BarChart3 className="h-5 w-5 text-indigo-600" />
      Bookings + Payments
    </CardTitle>
  </CardHeader>

  <CardContent className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {(["TODAY", "WEEK", "MONTH", "CUSTOM"] as ReportRange[]).map((r) => (
        <Button
          key={r}
          variant={range === r ? "default" : "outline"}
          onClick={() => setRange(r)}
          className="h-9"
        >
          {r === "TODAY"
            ? "Today"
            : r === "WEEK"
            ? "Last 7 days"
            : r === "MONTH"
            ? "This month"
            : "Custom"}
        </Button>
      ))}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
      {/* ✅ Property always LEFT (col 1) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-left">Property</label>
        <select
          value={propertyId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setPropertyId(e.target.value)}
          className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* ✅ Date filters (cols 2 & 3) only when CUSTOM */}
      {range === "CUSTOM" ? (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-left">From</label>
            <Input
              type="date"
              value={from}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-left">To</label>
            <Input
              type="date"
              value={to}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value)}
            />
          </div>
        </>
      ) : (
        // if not custom, just leave cols 2 & 3 empty
        <div className="hidden md:block md:col-span-2" />
      )}
    </div>

    <Separator />

    <div className="text-sm text-muted-foreground">
      Showing:{" "}
      <span className="font-medium text-slate-900">
        {effective.from} → {effective.to}
        {propertyId
          ? ` • ${properties.find((p) => p.id === propertyId)?.name ?? "Selected property"}`
          : " • All properties"}
      </span>
    </div>

    {error ? <p className="text-sm text-red-700">{error}</p> : null}
  </CardContent>
</Card>

      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as ReportTab)} className="space-y-4">
        <TabsList className="h-auto flex flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="OVERVIEW">Overview</TabsTrigger>
          <TabsTrigger value="REVENUE">Revenue & Payments</TabsTrigger>
          <TabsTrigger value="OUTSTANDING">Outstanding & Aging</TabsTrigger>
          <TabsTrigger value="OCCUPANCY">Occupancy & Stay</TabsTrigger>
          <TabsTrigger value="REFUNDS">Early Checkout & Refunds</TabsTrigger>
          <TabsTrigger value="DAMAGES">Damages & Incidents</TabsTrigger>
        </TabsList>

        <TabsContent value="OVERVIEW" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Bookings</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.bookingsCount ?? 0)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Booking Value</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.totalBookingAmount ?? 0))}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Collected</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.totalPaid ?? 0))}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Balance Due</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.outstanding ?? 0))}</div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Occupancy</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(report?.summary.occupancyRate ?? 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">{formatInteger(report?.summary.occupiedUnits ?? 0)} / {formatInteger(report?.summary.totalUnits ?? 0)} units</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Current Overstays</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.overstayCount ?? 0)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Early Check-outs</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.earlyCheckoutCount ?? 0)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Damage Charges</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.damagesCount ?? 0)}</div></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="REVENUE" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Booking Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.totalBookingAmount ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Collected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.totalPaid ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Balance Due</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.outstanding ?? 0))}</div></CardContent></Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Collection Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Number(report?.summary.totalBookingAmount ?? 0) > 0
                    ? `${((Number(report?.summary.totalPaid ?? 0) / Number(report?.summary.totalBookingAmount ?? 0)) * 100).toFixed(1)}%`
                    : "0.0%"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Daily breakdown</CardTitle></CardHeader>
            <CardContent>
              {!report ? (
                <div className="text-sm text-muted-foreground">{loading ? "Loading..." : "No data"}</div>
              ) : report.daily.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity for this period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Bookings</th>
                        <th className="py-2 pr-3">Check-ins</th>
                        <th className="py-2 pr-3">Booking Value</th>
                        <th className="py-2 pr-3">Paid</th>
                        <th className="py-2 pr-3">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.map((d) => (
                        <tr key={d.day} className="border-b">
                          <td className="py-2 pr-3 font-medium">{formatDateLagos(d.day)}</td>
                          <td className="py-2 pr-3">{formatInteger(d.bookingsCreated)}</td>
                          <td className="py-2 pr-3">{formatInteger(d.checkIns)}</td>
                          <td className="py-2 pr-3">{formatNaira(d.totalBookingAmount)}</td>
                          <td className="py-2 pr-3">{formatNaira(d.totalPaid)}</td>
                          <td className="py-2 pr-3">{formatNaira(d.outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="OUTSTANDING" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Balance Due</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.outstanding ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">0-7 Days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(outstandingAging.a0to7)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">8-30 Days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(outstandingAging.a8to30)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">31+ Days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(outstandingAging.a31plus)}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Outstanding bookings</CardTitle></CardHeader>
            <CardContent>
              {!report ? null : report.topOutstanding.length === 0 ? (
                <div className="text-sm text-muted-foreground">No outstanding balances.</div>
              ) : (
                <div className="space-y-2">
                  {report.topOutstanding.slice(0, 30).map((x) => (
                    <div key={x.bookingId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{x.guestName || "Guest"}</p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {(x.propertyName ? `${x.propertyName} — ` : "") + (x.unitName || "Unit")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Status: <span className="font-medium">{x.status}</span> • Payment:{" "}
                            <span className="font-medium">{x.paymentStatus}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatNaira(Number(x.outstanding))}</p>
                          <p className="text-xs text-muted-foreground">
                            Paid {formatNaira(Number(x.paidTotal))} / {formatNaira(Number(x.totalAmount))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="OCCUPANCY" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Occupancy Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(report?.summary.occupancyRate ?? 0).toFixed(1)}%</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Occupied Units</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.occupiedUnits ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Units</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.totalUnits ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Current Overstays</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.overstayCount ?? 0)}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Overstayed in-house bookings</CardTitle></CardHeader>
            <CardContent>
              {!report ? null : report.overstays.length === 0 ? (
                <div className="text-sm text-muted-foreground">No overstayed in-house bookings.</div>
              ) : (
                <div className="space-y-2">
                  {report.overstays.slice(0, 30).map((x) => (
                    <div key={x.bookingId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{x.guestName || "Guest"}</p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {(x.propertyName ? `${x.propertyName} — ` : "") + (x.unitName || "Unit")} • Due {x.scheduledCheckout}
                          </p>
                          <p className="text-xs text-amber-700 mt-1 font-medium">
                            Overstayed {formatInteger(x.daysOverstayed)} day{x.daysOverstayed === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">Posted {formatNaira(Number(x.postedOverstay))}</p>
                          <p className="text-xs text-muted-foreground">
                            Est. {formatNaira(Number(x.estimatedOverstay))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="REFUNDS" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Early Check-outs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.earlyCheckoutCount ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Refund Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.refundApprovedCount ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Eligible Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.refundEligibleTotal ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Approved Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.refundAmountTotal ?? 0))}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Early check-out refunds</CardTitle></CardHeader>
            <CardContent>
              {!report ? null : report.earlyCheckouts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No early checkout records for this period.</div>
              ) : (
                <div className="space-y-2">
                  {report.earlyCheckouts.slice(0, 30).map((x) => (
                    <div key={x.checkEventId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{x.guestName || "Guest"}</p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {(x.propertyName ? `${x.propertyName} — ` : "") + (x.unitName || "Unit")} • {x.checkedOutAt}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Policy: <span className="font-medium">{x.refundPolicy || "NO_REFUND"}</span> • Status:{" "}
                            <span className="font-medium">{x.refundStatus || "NOT_APPROVED"}</span>
                          </p>
                          {x.refundReason ? <p className="text-xs text-muted-foreground mt-1">Reason: {x.refundReason}</p> : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">Refund {formatNaira(Number(x.refundAmount))}</p>
                          <p className="text-xs text-muted-foreground">
                            Eligible {formatNaira(Number(x.refundEligibleAmount))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="DAMAGES" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Damage Charges</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.damagesCount ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Damage Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.damagesAmountTotal ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Overstay Charges</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.overstayAmountTotal ?? 0))}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Damage incidents</CardTitle></CardHeader>
            <CardContent>
              {!report ? null : report.damages.length === 0 ? (
                <div className="text-sm text-muted-foreground">No damage charges for this period.</div>
              ) : (
                <div className="space-y-2">
                  {report.damages.slice(0, 30).map((x) => (
                    <div key={x.chargeId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{x.guestName || "Guest"}</p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {(x.propertyName ? `${x.propertyName} — ` : "") + (x.unitName || "Unit")} • {x.createdAt}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{x.title}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatNaira(Number(x.amount))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
