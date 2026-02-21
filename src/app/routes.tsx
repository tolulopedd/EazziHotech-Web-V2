import { createBrowserRouter, Navigate, useRouteError } from "react-router-dom";
import { RequireAuth } from "@/app/RequireAuth";
import { AppLayout } from "@/layouts/AppLayout";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import News from "@/pages/News";
import NewsArticle from "@/pages/NewsArticle";
import NewsManager from "@/pages/NewsManager";
import PolicyPage from "@/pages/PolicyPage";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Bookings from "@/pages/Bookings";
import Payments from "@/pages/Payments";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import MyProfile from "@/pages/MyProfile";
import CheckInPage from "@/pages/CheckInPage";
import CheckOutPage from "@/pages/CheckOutPage";
import Guests from "@/pages/Guests";
import LeadsPage from "@/pages/LeadsPage";
import HelpManual from "@/pages/HelpManual";

// ✅ NEW
import ReportsPage from "@/pages/ReportsPage";

function RouteError() {
  const err: any = useRouteError();
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Route crashed</h1>
      <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
        {err?.message || String(err)}
      </pre>
    </div>
  );
}

export const router = createBrowserRouter([
  // Public
  { path: "/", element: <Landing />, errorElement: <RouteError /> },
  { path: "/news", element: <News />, errorElement: <RouteError /> },
  { path: "/news/:slug", element: <NewsArticle />, errorElement: <RouteError /> },
  { path: "/policies/:policyId", element: <PolicyPage />, errorElement: <RouteError /> },
  { path: "/login", element: <Login />, errorElement: <RouteError /> },
  { path: "/forgot-password", element: <ForgotPassword />, errorElement: <RouteError /> },
  { path: "/reset-password", element: <ResetPassword />, errorElement: <RouteError /> },

  // Protected App
  {
    path: "/app",
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: "dashboard", element: <Dashboard /> },

          { path: "properties", element: <Properties /> },
          { path: "guests", element: <Guests /> },
          { path: "bookings", element: <Bookings /> },
          { path: "payments", element: <Payments /> },

          // ✅ NEW
          { path: "reports", element: <ReportsPage /> },
          { path: "leads", element: <LeadsPage /> },
          { path: "news", element: <NewsManager /> },
          { path: "help", element: <HelpManual /> },

          { path: "settings", element: <Settings /> },
          { path: "users", element: <Users /> },
          { path: "profile", element: <MyProfile /> },
          { path: "check-in", element: <CheckInPage /> },
          { path: "check-out", element: <CheckOutPage /> },

          { path: "*", element: <div>404</div> },
        ],
      },
    ],
  },
]);
