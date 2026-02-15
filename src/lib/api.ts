const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";


export function setAuthSession(payload: {
  tenantId: string;
  accessToken: string;
  refreshToken?: string;
}) {
  localStorage.setItem("tenantId", payload.tenantId);
  localStorage.setItem("accessToken", payload.accessToken);
  if (payload.refreshToken) localStorage.setItem("refreshToken", payload.refreshToken);
}

export function getAccessToken() {
  return localStorage.getItem("accessToken") || "";
}

export function getTenantId() {
  return localStorage.getItem("tenantId") || "";
}

export function clearAuthSession() {
  localStorage.removeItem("tenantId");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}


export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const tenantId = getTenantId();
  const token = getAccessToken();

  if (tenantId) headers.set("x-tenant-id", tenantId);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // ✅ Auto-logout on invalid/expired token
  if (res.status === 401) {
    // Your backend log shows: { statusCode: 401, code: "UNAUTHORIZED", message: "Invalid or expired token" }
    // But your current parser expects data?.error?.message, so we check both shapes.
    const code =
      data?.code || data?.error?.code || data?.err?.code || "UNAUTHORIZED";
    const message =
      data?.message || data?.error?.message || data?.err?.message || "";

    const shouldLogout =
      code === "UNAUTHORIZED" ||
      String(message).toLowerCase().includes("invalid or expired token");

    if (shouldLogout) {
      // Clear auth + tenant
      clearAuthSession();
      localStorage.removeItem("token");

      // Redirect to login (keep where user was going)
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);

      // Stop further processing
      throw Object.assign(new Error("UNAUTHORIZED"), {
        code: "UNAUTHORIZED",
        status: 401,
        data,
      });
    }
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.message || "Request failed";
    const code = data?.error?.code || data?.code || "API_ERROR";
    throw Object.assign(new Error(message), { code, status: res.status, data });
  }

  return data;
}

export async function publicFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.message || "Request failed";
    const code = data?.error?.code || data?.code || "API_ERROR";
    throw Object.assign(new Error(message), { status: res.status, code, data });
  }

  return data;
}
