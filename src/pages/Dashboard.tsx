import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Building2,
  CalendarCheck2,
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DashboardStats {
  totalProperties: number;
  totalUnits: number;
  activeBookings: number;
  pendingPayments: number;
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
  stats: DashboardStats;
  recentBookings: RecentBooking[];
  pendingPayments: PendingPayment[];
  staffCount?: number;
  userRole: "admin" | "manager" | "staff";
}

// Mock data for development
const MOCK_DASHBOARD_DATA: DashboardData = {
  stats: {
    totalProperties: 5,
    totalUnits: 23,
    activeBookings: 12,
    pendingPayments: 3,
    totalRevenue: 45600,
    occupancyRate: 78,
  },
  recentBookings: [
    {
      id: "1",
      guestName: "John Doe",
      propertyName: "Sunset Villa",
      checkIn: "2026-01-25",
      checkOut: "2026-01-28",
      status: "confirmed",
      amount: 450,
    },
    {
      id: "2",
      guestName: "Jane Smith",
      propertyName: "Ocean View",
      checkIn: "2026-01-26",
      checkOut: "2026-02-02",
      status: "pending",
      amount: 720,
    },
    {
      id: "3",
      guestName: "Mike Johnson",
      propertyName: "Mountain Lodge",
      checkIn: "2026-01-20",
      checkOut: "2026-01-24",
      status: "completed",
      amount: 600,
    },
  ],
  pendingPayments: [
    {
      id: "p1",
      guestName: "Sarah Williams",
      propertyName: "Beach House",
      amount: 850,
      dueDate: "2026-01-22",
      status: "overdue",
    },
    {
      id: "p2",
      guestName: "Tom Brown",
      propertyName: "Garden Cottage",
      amount: 320,
      dueDate: "2026-01-28",
      status: "pending",
    },
  ],
  staffCount: 8,
  userRole: "admin",
};

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const result = await apiFetch("/api/dashboard");
        setData(result);
        setUseMockData(false);
      } catch (err: any) {
        console.error("Failed to load real dashboard data, using mock data:", err);
        // Use mock data as fallback
        setData(MOCK_DASHBOARD_DATA);
        setUseMockData(true);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
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
            <p className="text-muted-foreground text-sm mt-2">Please try refreshing the page</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = data.userRole === "admin";

  return (
    <div className="space-y-6">
      {/* Development Notice */}
      {useMockData && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-sm text-blue-800">
            💡 <strong>Development Mode:</strong> Using mock data. Connect your backend API to `/api/dashboard` to use real data.
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Here's your {isAdmin ? "workspace overview" : "property performance"}.
        </p>
      </div>

      {/* Key Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Properties"
          value={data.stats.totalProperties}
          icon={Building2}
          onClick={() => nav("/app/properties")}
        />
        <StatCard
          label="Units"
          value={data.stats.totalUnits}
          icon={Building2}
          variant="secondary"
        />
        <StatCard
          label="Active Bookings"
          value={data.stats.activeBookings}
          icon={CalendarCheck2}
          onClick={() => nav("/app/bookings")}
        />
        <StatCard
          label="Pending Payments"
          value={data.stats.pendingPayments}
          icon={CreditCard}
          variant="warning"
          onClick={() => nav("/app/payments")}
        />
        <StatCard
          label="Occupancy"
          value={`${data.stats.occupancyRate}%`}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Admin Only Section */}
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
                  <p className="text-3xl font-bold">{data.staffCount}</p>
                  <p className="text-sm text-muted-foreground">Staff members</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => nav("/app/settings")}>
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
                  <p className="text-3xl font-bold">₦{(data.stats.totalRevenue / 1000).toFixed(1)}k</p>
                  <p className="text-sm text-muted-foreground">Total revenue</p>
                </div>
                <div className="text-xs text-green-600">↑ 12% vs last month</div>
                <Button variant="outline" className="w-full" onClick={() => nav("/app/payments")}>
                  View Payments
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

      {/* Pending Payments */}
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
          <div className="grid gap-3 md:grid-cols-4">
            <ActionButton
              label="New Booking"
              onClick={() => nav("/app/bookings")}
              icon={CalendarCheck2}
            />
            <ActionButton
              label="View Properties"
              onClick={() => nav("/app/properties")}
              icon={Building2}
            />
            <ActionButton
              label="Process Payment"
              onClick={() => nav("/app/payments")}
              icon={CreditCard}
            />
            <ActionButton
              label="Settings"
              onClick={() => nav("/app/settings")}
              icon={Users}
            />
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
  variant?: "default" | "secondary" | "warning" | "success";
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, variant = "default", onClick }: StatCardProps) {
  const baseClass = "p-4 rounded-lg border cursor-pointer transition hover:shadow-md";
  const variantClass = {
    default: "bg-indigo-50 border-indigo-100 hover:border-indigo-300",
    secondary: "bg-slate-50 border-slate-100 hover:border-slate-300",
    warning: "bg-orange-50 border-orange-100 hover:border-orange-300",
    success: "bg-green-50 border-green-100 hover:border-green-300",
  }[variant];

  return (
    <div className={`${baseClass} ${variantClass}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <Icon className={`h-5 w-5 opacity-70 ${
          variant === "warning" ? "text-orange-600" : 
          variant === "success" ? "text-green-600" :
          variant === "secondary" ? "text-slate-600" :
          "text-indigo-600"
        }`} />
      </div>
    </div>
  );
}

interface BookingItemProps {
  booking: RecentBooking;
}

function BookingItem({ booking }: BookingItemProps) {
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
      <div className="text-right">
        <p className="font-medium">₦{booking.amount}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
        </p>
      </div>
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[booking.status]}`}>
        {booking.status}
      </span>
    </div>
  );
}

interface PaymentItemProps {
  payment: PendingPayment;
}

function PaymentItem({ payment }: PaymentItemProps) {
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
        <p className="font-medium">₦{payment.amount}</p>
        <p className={`text-xs ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
          {new Date(payment.dueDate).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

function ActionButton({ label, icon: Icon, onClick }: ActionButtonProps) {
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