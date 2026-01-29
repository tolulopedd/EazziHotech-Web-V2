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

  if (!res.ok) {
    const message = data?.error?.message || "Request failed";
    const code = data?.error?.code || "API_ERROR";
    throw Object.assign(new Error(message), { code, status: res.status, data });
  }

  return data;
}

export async function publicFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = data?.error?.message || "Request failed";
    throw Object.assign(new Error(message), { status: res.status, data });
  }

  return data;
}