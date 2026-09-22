import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, RefreshCcw } from "lucide-react";
import { formatNaira } from "@/lib/currency";
import { formatDateLagos, formatInteger } from "@/lib/format";

type ReportRange = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";
type ReportTab =
  | "BOOKINGS"
  | "PAYMENTS"
  | "RECEIVABLES"
  | "GUEST_PAYMENT_HISTORY"
  | "GUEST_DETAILS"
  | "GUEST_VISIT_HISTORY"
  | "REVENUE"
  | "OCCUPANCY"
  | "REFUNDS"
  | "DAMAGES";

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
  bookingsReportRows: Array<{
    bookingId: string;
    date: string;
    guestName: string;
    room: string;
    propertyName: string;
    bookingAmount: string;
    paid: string;
    outstanding: string;
    currency: string;
    status: string;
    paymentStatus: string;
  }>;
  paymentRows: Array<{
    paymentId: string;
    date: string;
    bookingId: string;
    guestName: string;
    room: string;
    propertyName: string;
    bookingAmount: string;
    paid: string;
    currency: string;
  }>;
  receivablesRows: Array<{
    date: string;
    bookingId: string;
    guestName: string;
    room: string;
    propertyName: string;
    bookingAmount: string;
    outstandingAmount: string;
    currency: string;
  }>;
  guestPaymentHistoryRows: Array<{
    date: string;
    guestName: string;
    room: string;
    propertyName: string;
    bookingId: string;
    bookingAmount: string;
    paid: string;
    currency: string;
  }>;
  guestDetails: Array<{
    name: string;
    phone: string;
    email: string;
  }>;
  guestVisitHistoryRows: Array<{
    bookingId: string;
    name: string;
    checkInDate: string;
    checkOutDate: string;
    room: string;
    propertyName: string;
    status: string;
  }>;
  revenueSalesRows: Array<{
    date: string;
    room: string;
    propertyName: string;
    amount: string;
    currency: string;
    guestName: string;
    bookingId: string;
  }>;
  occupancyRows: Array<{
    date: string;
    room: string;
    propertyName: string;
    status: "OCCUPIED" | "NOT_OCCUPIED";
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

type ExportValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, ExportValue>;
type ReportExport = { title: string; slug: string; headers: string[]; rows: ExportRow[] };

function toISODate(d: Date) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

function getErrorMessage(e: unknown, fallback: string) {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function csvCell(value: ExportValue) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function xmlCell(value: ExportValue) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildExcelXml(title: string, headers: string[], rows: ExportRow[]) {
  const safeSheetName = title.replace(/[\\/:*?\[\]]/g, " ").slice(0, 31) || "Report";
  const tableRows = [
    `<Row><Cell ss:StyleID="title"><Data ss:Type="String">${xmlCell(title)}</Data></Cell></Row>`,
    `<Row>${headers.map((header) => `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlCell(header)}</Data></Cell>`).join("")}</Row>`,
    ...rows.map((row) => `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlCell(row[header])}</Data></Cell>`).join("")}</Row>`),
  ].join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/></Style><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#E0E7FF" ss:Pattern="Solid"/></Style></Styles>
 <Worksheet ss:Name="${xmlCell(safeSheetName)}"><Table>${tableRows}</Table></Worksheet>
</Workbook>`;
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200">{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground">{text}</div>;
}

function matchesReportSearch(
  query: string,
  values: Array<string | null | undefined>
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => String(v ?? "").toLowerCase().includes(q));
}

export default function ReportsPage() {
  const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
  const isAdmin = userRole === "admin";

  const [activeTab, setActiveTab] = useState<ReportTab>("BOOKINGS");
  const [range, setRange] = useState<ReportRange>("MONTH");
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return toISODate(d);
  });
  const [to, setTo] = useState<string>(() => toISODate(new Date()));

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<"CSV" | "EXCEL" | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportSearch, setReportSearch] = useState("");

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

  const filteredBookingsRows = useMemo(() => {
    const rows = report?.bookingsReportRows ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.guestName, x.room]));
  }, [report?.bookingsReportRows, reportSearch]);

  const filteredPaymentRows = useMemo(() => {
    const rows = report?.paymentRows ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.guestName, x.room]));
  }, [report?.paymentRows, reportSearch]);

  const filteredReceivableRows = useMemo(() => {
    const rows = report?.receivablesRows ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.guestName, x.room]));
  }, [report?.receivablesRows, reportSearch]);

  const filteredGuestPaymentHistoryRows = useMemo(() => {
    const rows = report?.guestPaymentHistoryRows ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.guestName, x.room]));
  }, [report?.guestPaymentHistoryRows, reportSearch]);

  const filteredGuestDetailsRows = useMemo(() => {
    const rows = report?.guestDetails ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.name]));
  }, [report?.guestDetails, reportSearch]);

  const filteredGuestVisitRows = useMemo(() => {
    const rows = report?.guestVisitHistoryRows ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.name, x.room]));
  }, [report?.guestVisitHistoryRows, reportSearch]);

  const filteredRevenueRows = useMemo(() => {
    const rows = report?.revenueSalesRows ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.guestName, x.room]));
  }, [report?.revenueSalesRows, reportSearch]);

  const filteredOccupancyRows = useMemo(() => {
    const rows = report?.occupancyRows ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.room]));
  }, [report?.occupancyRows, reportSearch]);

  const filteredEarlyCheckoutRows = useMemo(() => {
    const rows = report?.earlyCheckouts ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.guestName, x.unitName]));
  }, [report?.earlyCheckouts, reportSearch]);

  const filteredDamageRows = useMemo(() => {
    const rows = report?.damages ?? [];
    return rows.filter((x) => matchesReportSearch(reportSearch, [x.guestName, x.unitName]));
  }, [report?.damages, reportSearch]);

  const activeExport = useMemo<ReportExport>(() => {
    const room = (propertyName: string | null | undefined, unitName: string | null | undefined) => propertyName ? `${propertyName} - ${unitName || "Unit"}` : unitName || "Unit";
    const date = (value: string) => formatDateLagos(value);
    const reference = (id: string) => id.slice(0, 8).toUpperCase();

    switch (activeTab) {
      case "PAYMENTS": return { title: "Payments Report", slug: "payments", headers: ["Date", "Guest", "Room", "Booking Amount", "Paid", "Booking Reference"], rows: filteredPaymentRows.map((x) => ({ "Date": date(x.date), "Guest": x.guestName || "Guest", "Room": room(x.propertyName, x.room), "Booking Amount": x.bookingAmount, "Paid": x.paid, "Booking Reference": reference(x.bookingId) })) };
      case "RECEIVABLES": return { title: "Receivables Report", slug: "receivables", headers: ["Date", "Guest", "Room", "Booking Amount", "Outstanding Amount", "Booking Reference"], rows: filteredReceivableRows.map((x) => ({ "Date": date(x.date), "Guest": x.guestName || "Guest", "Room": room(x.propertyName, x.room), "Booking Amount": x.bookingAmount, "Outstanding Amount": x.outstandingAmount, "Booking Reference": reference(x.bookingId) })) };
      case "GUEST_PAYMENT_HISTORY": return { title: "Guest Payment History", slug: "guest-payment-history", headers: ["Date", "Guest", "Room", "Booking Amount", "Paid", "Booking Reference"], rows: filteredGuestPaymentHistoryRows.map((x) => ({ "Date": date(x.date), "Guest": x.guestName || "Guest", "Room": room(x.propertyName, x.room), "Booking Amount": x.bookingAmount, "Paid": x.paid, "Booking Reference": reference(x.bookingId) })) };
      case "GUEST_DETAILS": return { title: "Guest Details", slug: "guest-details", headers: ["Name", "Phone Number", "Email"], rows: filteredGuestDetailsRows.map((x) => ({ "Name": x.name || "Guest", "Phone Number": x.phone || "-", "Email": x.email || "-" })) };
      case "GUEST_VISIT_HISTORY": return { title: "Guest Visit History", slug: "guest-visit-history", headers: ["Name", "Check-in Date", "Check-out Date", "Room", "Status", "Booking Reference"], rows: filteredGuestVisitRows.map((x) => ({ "Name": x.name || "Guest", "Check-in Date": date(x.checkInDate), "Check-out Date": date(x.checkOutDate), "Room": room(x.propertyName, x.room), "Status": x.status, "Booking Reference": reference(x.bookingId) })) };
      case "REVENUE": return { title: "Revenue and Sales Report", slug: "revenue-sales", headers: ["Date", "Guest", "Room", "Amount", "Booking Reference"], rows: filteredRevenueRows.map((x) => ({ "Date": date(x.date), "Guest": x.guestName || "Guest", "Room": room(x.propertyName, x.room), "Amount": x.amount, "Booking Reference": reference(x.bookingId) })) };
      case "OCCUPANCY": return { title: "Occupancy and Stay Report", slug: "occupancy-stay", headers: ["Date", "Room", "Status"], rows: filteredOccupancyRows.map((x) => ({ "Date": date(x.date), "Room": room(x.propertyName, x.room), "Status": x.status === "OCCUPIED" ? "Occupied" : "Not occupied" })) };
      case "REFUNDS": return { title: "Early Checkout and Refunds Report", slug: "early-checkout-refunds", headers: ["Date", "Guest", "Room", "Refund Policy", "Eligible Amount", "Refund Amount", "Refund Status", "Reason", "Booking Reference"], rows: filteredEarlyCheckoutRows.map((x) => ({ "Date": date(x.checkedOutAt), "Guest": x.guestName || "Guest", "Room": room(x.propertyName, x.unitName), "Refund Policy": x.refundPolicy || "NO_REFUND", "Eligible Amount": x.refundEligibleAmount, "Refund Amount": x.refundAmount, "Refund Status": x.refundStatus || "-", "Reason": x.refundReason || "-", "Booking Reference": reference(x.bookingId) })) };
      case "DAMAGES": return { title: "Damages and Incidents Report", slug: "damages-incidents", headers: ["Date", "Guest", "Room", "Incident", "Amount", "Booking Reference"], rows: filteredDamageRows.map((x) => ({ "Date": date(x.createdAt), "Guest": x.guestName || "Guest", "Room": room(x.propertyName, x.unitName), "Incident": x.title, "Amount": x.amount, "Booking Reference": reference(x.bookingId) })) };
      case "BOOKINGS": default: return { title: "Bookings Report", slug: "bookings", headers: ["Date", "Guest", "Room", "Booking Amount", "Paid", "Outstanding", "Stay Status", "Payment Status", "Booking Reference"], rows: filteredBookingsRows.map((x) => ({ "Date": date(x.date), "Guest": x.guestName || "Guest", "Room": room(x.propertyName, x.room), "Booking Amount": x.bookingAmount, "Paid": x.paid, "Outstanding": x.outstanding, "Stay Status": x.status, "Payment Status": x.paymentStatus, "Booking Reference": reference(x.bookingId) })) };
    }
  }, [activeTab, filteredBookingsRows, filteredDamageRows, filteredEarlyCheckoutRows, filteredGuestDetailsRows, filteredGuestPaymentHistoryRows, filteredGuestVisitRows, filteredOccupancyRows, filteredPaymentRows, filteredReceivableRows, filteredRevenueRows]);

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
      const scopedPropertyId = isAdmin ? propertyId : "";
      const qs =
        `?from=${encodeURIComponent(effective.from)}` +
        `&to=${encodeURIComponent(effective.to)}` +
        (scopedPropertyId ? `&propertyId=${encodeURIComponent(scopedPropertyId)}` : "");

      const data = await apiFetch(`/api/reports/bookings-payments${qs}`);
      setReport(data as ReportResponse);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load report"));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function exportActiveReport(format: "CSV" | "EXCEL") {
    if (activeExport.rows.length === 0) {
      setError("There are no rows in the current filtered report to export.");
      return;
    }
    setError("");
    setDownloading(format);
    try {
      const filename = `${activeExport.slug}_${effective.from}_${effective.to}`;
      if (format === "CSV") {
        const csv = `\uFEFF${activeExport.headers.map(csvCell).join(",")}\n${activeExport.rows.map((row) => activeExport.headers.map((header) => csvCell(row[header])).join(",")).join("\n")}`;
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
      } else {
        const excel = buildExcelXml(activeExport.title, activeExport.headers, activeExport.rows);
        downloadBlob(new Blob([excel], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filename}.xls`);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to export the selected report"));
    } finally {
      setDownloading(null);
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (!isAdmin && propertyId) setPropertyId("");
  }, [isAdmin, propertyId]);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective.from, effective.to, range, propertyId]);

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Report Filters
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
            <div className="space-y-1 lg:col-span-5">
              <label className="block text-sm font-medium text-left">Period</label>
              <div className="flex flex-wrap gap-1.5">
                {(["TODAY", "WEEK", "MONTH", "CUSTOM"] as ReportRange[]).map((r) => (
                  <Button key={r} variant={range === r ? "default" : "outline"} onClick={() => setRange(r)} className="h-9 px-3">
                    {r === "TODAY" ? "Today" : r === "WEEK" ? "Last 7 days" : r === "MONTH" ? "This month" : "Custom"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1 lg:col-span-4">
              <label className="block text-sm font-medium text-left">Property</label>
              {isAdmin ? (
                <select
                  value={propertyId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setPropertyId(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">All properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm flex items-center text-slate-700">
                  Assigned properties (auto-scoped)
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 lg:col-span-3">
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Showing</span>
              <span className="font-semibold text-slate-900">{formatDateLagos(effective.from)} → {formatDateLagos(effective.to)}</span>
            </div>

            {range === "CUSTOM" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-left">From</label>
                  <Input type="date" value={from} onChange={(e: ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-left">To</label>
                  <Input type="date" value={to} onChange={(e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Sales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.totalPaid ?? 0))}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Booking Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.totalBookingAmount ?? 0))}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Receivables</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.outstanding ?? 0))}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Occupancy</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(report?.summary.occupancyRate ?? 0).toFixed(1)}%</div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as ReportTab)} className="space-y-4">
        <TabsList className="h-auto flex flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="BOOKINGS">1. Bookings</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="PAYMENTS">2. Payments</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="RECEIVABLES">3. Receivables</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="GUEST_PAYMENT_HISTORY">4. Guest Payment History</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="GUEST_DETAILS">5. Guest Details</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="GUEST_VISIT_HISTORY">6. Guest Visit History</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="REVENUE">7. Revenue/Sales</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="OCCUPANCY">8. Occupancy & Stay</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="REFUNDS">9. Early Checkout & Refunds</TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm" value="DAMAGES">10. Damages & Incidents</TabsTrigger>
        </TabsList>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="w-full lg:max-w-sm">
            <Input
              value={reportSearch}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setReportSearch(e.target.value)}
              placeholder="Search by guest or room..."
            />
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Button variant="outline" onClick={loadReport} disabled={loading}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => exportActiveReport("CSV")} disabled={loading || downloading !== null || activeExport.rows.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {downloading === "CSV" ? "Exporting..." : "Export CSV"}
            </Button>
            <Button variant="outline" onClick={() => exportActiveReport("EXCEL")} disabled={loading || downloading !== null || activeExport.rows.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {downloading === "EXCEL" ? "Exporting..." : "Export Excel"}
            </Button>
          </div>
        </div>

        <TabsContent value="BOOKINGS">
          <Card>
            <CardHeader><CardTitle>Bookings Report</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.bookingsReportRows.length === 0 ? <EmptyState text="No bookings for selected period." /> : filteredBookingsRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Guest</th><th className="p-2">Room</th><th className="p-2">Booking Amount</th><th className="p-2">Paid</th><th className="p-2">Outstanding</th></tr></thead>
                    <tbody>
                      {filteredBookingsRows.map((x) => (
                        <tr key={x.bookingId} className="border-b">
                          <td className="p-2">{formatDateLagos(x.date)}</td>
                          <td className="p-2">{x.guestName || "Guest"}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.room || "Unit"}</td>
                          <td className="p-2">{formatNaira(Number(x.bookingAmount))}</td>
                          <td className="p-2">{formatNaira(Number(x.paid))}</td>
                          <td className="p-2">{formatNaira(Number(x.outstanding))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="PAYMENTS">
          <Card>
            <CardHeader><CardTitle>Payments Report</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.paymentRows.length === 0 ? <EmptyState text="No payment records for selected period." /> : filteredPaymentRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Guest</th><th className="p-2">Room</th><th className="p-2">Booking Amount</th><th className="p-2">Paid</th></tr></thead>
                    <tbody>
                      {filteredPaymentRows.map((x) => (
                        <tr key={x.paymentId} className="border-b">
                          <td className="p-2">{formatDateLagos(x.date)}</td>
                          <td className="p-2">{x.guestName || "Guest"}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.room || "Unit"}</td>
                          <td className="p-2">{formatNaira(Number(x.bookingAmount))}</td>
                          <td className="p-2">{formatNaira(Number(x.paid))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="RECEIVABLES">
          <Card>
            <CardHeader><CardTitle>Receivables / Outstanding</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.receivablesRows.length === 0 ? <EmptyState text="No outstanding receivables." /> : filteredReceivableRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Guest</th><th className="p-2">Room</th><th className="p-2">Booking Amount</th><th className="p-2">Outstanding Amount</th></tr></thead>
                    <tbody>
                      {filteredReceivableRows.map((x) => (
                        <tr key={`${x.bookingId}-${x.date}`} className="border-b">
                          <td className="p-2">{formatDateLagos(x.date)}</td>
                          <td className="p-2">{x.guestName || "Guest"}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.room || "Unit"}</td>
                          <td className="p-2">{formatNaira(Number(x.bookingAmount))}</td>
                          <td className="p-2">{formatNaira(Number(x.outstandingAmount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="GUEST_PAYMENT_HISTORY">
          <Card>
            <CardHeader><CardTitle>Guest Payment History</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.guestPaymentHistoryRows.length === 0 ? <EmptyState text="No guest payment history for this period." /> : filteredGuestPaymentHistoryRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Guest</th><th className="p-2">Room</th><th className="p-2">Booking Amount</th><th className="p-2">Paid</th></tr></thead>
                    <tbody>
                      {filteredGuestPaymentHistoryRows.map((x) => (
                        <tr key={`${x.bookingId}-${x.date}-${x.paid}`} className="border-b">
                          <td className="p-2">{formatDateLagos(x.date)}</td>
                          <td className="p-2">{x.guestName || "Guest"}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.room || "Unit"}</td>
                          <td className="p-2">{formatNaira(Number(x.bookingAmount))}</td>
                          <td className="p-2">{formatNaira(Number(x.paid))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="GUEST_DETAILS">
          <Card>
            <CardHeader><CardTitle>Guest Details</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.guestDetails.length === 0 ? <EmptyState text="No guest details available." /> : filteredGuestDetailsRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Name</th><th className="p-2">Phone Number</th><th className="p-2">Email</th></tr></thead>
                    <tbody>
                      {filteredGuestDetailsRows.map((x) => (
                        <tr key={`${x.name}-${x.phone}-${x.email}`} className="border-b">
                          <td className="p-2">{x.name || "Guest"}</td>
                          <td className="p-2">{x.phone || "-"}</td>
                          <td className="p-2">{x.email || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="GUEST_VISIT_HISTORY">
          <Card>
            <CardHeader><CardTitle>Guest Visit History</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.guestVisitHistoryRows.length === 0 ? <EmptyState text="No guest visit history available." /> : filteredGuestVisitRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Name</th><th className="p-2">Check-in Date</th><th className="p-2">Check-out Date</th></tr></thead>
                    <tbody>
                      {filteredGuestVisitRows.map((x) => (
                        <tr key={x.bookingId} className="border-b">
                          <td className="p-2">{x.name || "Guest"}</td>
                          <td className="p-2">{formatDateLagos(x.checkInDate)}</td>
                          <td className="p-2">{formatDateLagos(x.checkOutDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="REVENUE">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Sales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.totalPaid ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(filteredRevenueRows.length)}</div></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Revenue / Sales Details</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.revenueSalesRows.length === 0 ? <EmptyState text="No revenue entries in selected period." /> : filteredRevenueRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Room</th><th className="p-2">Amount</th></tr></thead>
                    <tbody>
                      {filteredRevenueRows.map((x, i) => (
                        <tr key={`${x.bookingId}-${x.date}-${i}`} className="border-b">
                          <td className="p-2">{formatDateLagos(x.date)}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.room || "Unit"}</td>
                          <td className="p-2">{formatNaira(Number(x.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="OCCUPANCY">
          <Card>
            <CardHeader><CardTitle>Occupancy & Stay</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.occupancyRows.length === 0 ? <EmptyState text="No occupancy rows available." /> : filteredOccupancyRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Room</th><th className="p-2">Status</th></tr></thead>
                    <tbody>
                      {filteredOccupancyRows.map((x, i) => (
                        <tr key={`${x.room}-${x.date}-${i}`} className="border-b">
                          <td className="p-2">{formatDateLagos(x.date)}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.room}</td>
                          <td className="p-2">{x.status === "OCCUPIED" ? "Occupied" : "Not occupied"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="REFUNDS">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Early Check-outs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.earlyCheckoutCount ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Refund Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.refundApprovedCount ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Eligible Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.refundEligibleTotal ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Approved Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.refundAmountTotal ?? 0))}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Early Checkout & Refunds</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.earlyCheckouts.length === 0 ? <EmptyState text="No early checkout records for this period." /> : filteredEarlyCheckoutRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Guest</th><th className="p-2">Room</th><th className="p-2">Policy</th><th className="p-2">Refund</th></tr></thead>
                    <tbody>
                      {filteredEarlyCheckoutRows.map((x) => (
                        <tr key={x.checkEventId} className="border-b">
                          <td className="p-2">{formatDateLagos(x.checkedOutAt)}</td>
                          <td className="p-2">{x.guestName || "Guest"}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.unitName || "Unit"}</td>
                          <td className="p-2">{x.refundPolicy || "NO_REFUND"}</td>
                          <td className="p-2">{formatNaira(Number(x.refundAmount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="DAMAGES">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Damage Charges</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatInteger(report?.summary.damagesCount ?? 0)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Damage Amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.damagesAmountTotal ?? 0))}</div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Overstay Charges</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(Number(report?.summary.overstayAmountTotal ?? 0))}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Damages & Incidents</CardTitle></CardHeader>
            <CardContent>
              {!report ? <EmptyState text={loading ? "Loading..." : "No data"} /> : report.damages.length === 0 ? <EmptyState text="No damage incidents for this period." /> : filteredDamageRows.length === 0 ? <EmptyState text="No match for this search." /> : (
                <TableShell>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="p-2">Date</th><th className="p-2">Guest</th><th className="p-2">Room</th><th className="p-2">Incident</th><th className="p-2">Amount</th></tr></thead>
                    <tbody>
                      {filteredDamageRows.map((x) => (
                        <tr key={x.chargeId} className="border-b">
                          <td className="p-2">{formatDateLagos(x.createdAt)}</td>
                          <td className="p-2">{x.guestName || "Guest"}</td>
                          <td className="p-2">{x.propertyName ? `${x.propertyName} - ` : ""}{x.unitName || "Unit"}</td>
                          <td className="p-2">{x.title}</td>
                          <td className="p-2">{formatNaira(Number(x.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {report ? (
        <div className="text-xs text-muted-foreground">
          Rows: Bookings {formatInteger(report.bookingsReportRows.length)} • Payments {formatInteger(report.paymentRows.length)} • Receivables {formatInteger(report.receivablesRows.length)} • Guests {formatInteger(report.guestDetails.length)}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-muted-foreground">Loading report data…</div> : null}
    </div>
  );
}
