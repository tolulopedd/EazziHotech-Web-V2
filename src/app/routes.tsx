import { createBrowserRouter, Navigate, useRouteError } from "react-router-dom";
import { RequireAuth } from "@/app/RequireAuth";
import { AppLayout } from "@/layouts/AppLayout";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";

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
          { path: "bookings", element: <div>Bookings</div> },
          { path: "payments", element: <div>Payments</div> },
          { path: "settings", element: <div>Settings</div> },
          { path: "*", element: <div>404</div> },
        ],
      },
    ],
  },
]);