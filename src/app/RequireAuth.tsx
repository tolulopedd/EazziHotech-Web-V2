import { useEffect, useRef } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { clearAuthSession, getAccessToken } from "@/lib/api";
import { emitLogout } from "@/lib/authEvents";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function RequireAuth() {
  const nav = useNavigate();
  const token = getAccessToken();
  const timeoutRef = useRef<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    const clearTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const expireSession = () => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      clearTimer();

      clearAuthSession();
      localStorage.removeItem("token");
      localStorage.removeItem("tenantName");
      localStorage.removeItem("tenantSlug");
      localStorage.removeItem("userName");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userId");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("isSuperAdmin");
      localStorage.removeItem("subscriptionStatus");
      localStorage.removeItem("subscriptionCurrentPeriodEndAt");
      localStorage.removeItem("subscriptionDaysToExpiry");

      emitLogout("idle_timeout");
      toast.error("Session expired due to inactivity. Please log in again.");
      nav("/login", { replace: true });
    };

    const resetTimer = () => {
      if (expiredRef.current) return;
      clearTimer();
      timeoutRef.current = window.setTimeout(expireSession, IDLE_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      clearTimer();
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [nav, token]);

  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}
