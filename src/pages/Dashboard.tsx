import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Building2,
  CalendarCheck2,
  CreditCard,
  Users,
  Settings,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatNaira } from "@/lib/currency";

type UserRole = "admin" | "manager" | "staff";

interface DashboardStats {
  totalProperties: number;
  totalUnits: number;
  activeBookings: number;
  pendingPayments: number; // NOTE: from /api/dashboard (payment records), not outstanding bookings
  totalRevenue: number;
  occupancyRate: number;
}

interface RecentBooking {
  id: string;
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "pending" | "completed";
  amount: number;
}

interface PendingPayment {
  id: string;
  guestName: string;
  propertyName: string;
  amount: number;
  dueDate: string;
  status: "pending" | "overdue";
}

interface DashboardData {
  userRole: UserRole;
  stats: DashboardStats;
  recentBookings: RecentBooking[];
  pendingPayments: PendingPayment[];
  staffCount?: number;
}

/** Matches /api/payments/pending response shape used in Payments.tsx */
type OutstandingItem = {
  bookingId: string;
  guestName: string | null;
  unitName?: string | null;
  bookingStatus: string;
  paymentStatus: string; // UNPAID | PARTPAID
  totalAmount: string;
  paidTotal: string;
  outstanding: string;
  currency: string;
};

type OutstandingResponse = { items: OutstandingItem[] };

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ✅ NEW: outstanding bookings count (same as Payments.tsx "Pending (Outstanding)")
  const [outstandingCount, setOutstandingCount] = useState<number>(0);

  useEffect(() => {
    let alive = true;

    async function fetchAll() {
      try {
        setLoading(true);
        setErrMsg(null);

        // Fetch dashboard + outstanding in parallel
        const [dash, outstanding] = await Promise.all([
          apiFetch("/api/dashboard") as Promise<DashboardData>,
          apiFetch("/api/payments/pending") as Promise<OutstandingResponse>,
        ]);

        if (!alive) return;

        setData(dash);
        setOutstandingCount((outstanding?.items ?? []).length);
      } catch (err: any) {
        console.error("Failed to load dashboard:", err);
        if (!alive) return;

        setErrMsg(err?.message || "Failed to load dashboard");
        setData(null);
        setOutstandingCount(0);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    fetchAll();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-100 mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-semibold">Failed to load dashboard</p>
            <p className="text-muted-foreground text-sm mt-2">{errMsg ?? "Please refresh."}</p>
            <div className="mt-4">
              <Button onClick={() => window.location.reload()}>Refresh</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = data.userRole === "admin";
  const isManager = data.userRole === "manager";
  const isStaff = data.userRole === "staff";

  // Occupancy coloring: Green >= 70, Amber 30-69.9, Red < 30
  const occupancyVariant: StatCardProps["variant"] =
    data.stats.occupancyRate >= 60
      ? "success"
      : data.stats.occupancyRate >= 30
      ? "warning"
      : "danger";

  // ✅ This is the value you WANT on the dashboard (same concept as Payments.tsx pending tab)
  const pendingPaymentsCount = outstandingCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          {isAdmin && "Welcome back! Here’s an overview of your entire workspace."}
          {isManager && "Welcome back! Here’s an overview of your tenant’s performance."}
          {isStaff && "Welcome back! Here are the bookings and payments to monitor today."}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {!isStaff && (
          <StatCard
            label="Properties"
            value={data.stats.totalProperties}
            icon={Building2}
            onClick={() => nav("/app/properties")}
          />
        )}

        <StatCard
          label="Units"
          value={data.stats.totalUnits}
          icon={Building2}
          variant="secondary"
          onClick={!isStaff ? () => nav("/app/properties") : undefined}
        />

        <StatCard
          label="Active Bookings"
          value={data.stats.activeBookings}
          icon={CalendarCheck2}
          onClick={() => nav("/app/bookings")}
        />

        {/* Pending Payments = Outstanding bookings (same as Payments.tsx tab) */}
        <StatCard
          label="Pending Payments"
          value={pendingPaymentsCount}
          icon={CreditCard}
          variant={pendingPaymentsCount > 0 ? "warning" : "secondary"}
          onClick={() => nav("/app/payments")}
        />

        <StatCard
          label="Occupancy"
          value={`${data.stats.occupancyRate}%`}
          icon={TrendingUp}
          variant={occupancyVariant}
        />
      </div>

      {/* Admin-only cards */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-bold">{data.staffCount ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Staff members</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => nav("/app/users")}>
                  Manage Team
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold">{formatNaira(data.stats.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">Total revenue</p>
                </div>

                <Button variant="outline" className="w-full" onClick={() => nav("/app/payments")}>
                  View Confirmed Payments
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Bookings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Bookings</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => nav("/app/bookings")}>
            View all <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {data.recentBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarCheck2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recent bookings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentBookings.map((booking) => (
                <BookingItem key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Payments (this section is still based on /api/dashboard pendingPayments list of Payment rows) */}
      {data.pendingPayments.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Pending Payments</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.pendingPayments.length} awaiting confirmation
              </p>
            </div>
            <Button onClick={() => nav("/app/payments")}>
              Review Payments <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.pendingPayments.map((payment) => (
                <PaymentItem key={payment.id} payment={payment} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <ActionButton label="Bookings" onClick={() => nav("/app/bookings")} icon={CalendarCheck2} />
            <ActionButton label="Payments" onClick={() => nav("/app/payments")} icon={CreditCard} />
            {!isStaff && (
              <ActionButton label="Properties" onClick={() => nav("/app/properties")} icon={Building2} />
            )}
            {isAdmin && (
              <ActionButton label="Settings" onClick={() => nav("/app/settings")} icon={Settings} />
            )}
            {isAdmin && (
              <ActionButton label="Users" onClick={() => nav("/app/users")} icon={Users} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "secondary" | "warning" | "success" | "danger";
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, variant = "default", onClick }: StatCardProps) {
  const baseClass = "p-4 rounded-lg border cursor-pointer transition hover:shadow-md";
  const variantClass = {
    default: "bg-indigo-50 border-indigo-100 hover:border-indigo-300",
    secondary: "bg-slate-50 border-slate-100 hover:border-slate-300",
    warning: "bg-orange-50 border-orange-100 hover:border-orange-300",
    success: "bg-green-50 border-green-100 hover:border-green-300",
    danger: "bg-red-50 border-red-100 hover:border-red-300",
  }[variant];

  return (
    <div className={`${baseClass} ${variantClass}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <Icon
          className={`h-5 w-5 opacity-70 ${
            variant === "warning"
              ? "text-orange-600"
              : variant === "success"
              ? "text-green-600"
              : variant === "danger"
              ? "text-red-600"
              : variant === "secondary"
              ? "text-slate-600"
              : "text-indigo-600"
          }`}
        />
      </div>
    </div>
  );
}

function BookingItem({ booking }: { booking: RecentBooking }) {
  const statusColors = {
    confirmed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
          <div>
            <p className="font-medium">{booking.guestName}</p>
            <p className="text-xs text-muted-foreground">{booking.propertyName}</p>
          </div>
        </div>
      </div>

      <div className="text-right mr-4">
        <p className="font-medium">{formatNaira(booking.amount)}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(booking.checkIn).toLocaleDateString()} -{" "}
          {new Date(booking.checkOut).toLocaleDateString()}
        </p>
      </div>

      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[booking.status]}`}>
        {booking.status}
      </span>
    </div>
  );
}

function PaymentItem({ payment }: { payment: PendingPayment }) {
  const isOverdue = payment.status === "overdue";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {isOverdue ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <Clock className="h-4 w-4 text-orange-600" />
          )}
          <div>
            <p className="font-medium">{payment.guestName}</p>
            <p className="text-xs text-muted-foreground">{payment.propertyName}</p>
          </div>
        </div>
      </div>

      <div className="text-right">
        <p className="font-medium">{formatNaira(payment.amount)}</p>
        <p className={`text-xs ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
          {new Date(payment.dueDate).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition text-center"
    >
      <Icon className="h-5 w-5 text-indigo-600" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
