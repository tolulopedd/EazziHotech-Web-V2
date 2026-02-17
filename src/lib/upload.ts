// src/lib/upload.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function getAuthToken(): string {
  return localStorage.getItem("accessToken") || "";
}

function getTenantId(): string {
  return localStorage.getItem("tenantId") || "";
}

function toApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

function getApiHeaders(extra?: Record<string, string>) {
  const token = getAuthToken();
  const tenantId = getTenantId();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (tenantId) headers["x-tenant-id"] = tenantId;
  return { ...headers, ...(extra || {}) };
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const j = await res.json();
    return j?.error?.message || j?.message || fallback;
  } catch {
    return fallback;
  }
}

async function postJson(path: string, payload: unknown) {
  const res = await fetch(toApiUrl(path), {
    method: "POST",
    headers: getApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = "Request failed";
    let code = "";
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.message || msg;
      code = j?.error?.code || j?.code || "";
    } catch {}
    const err = new Error(msg) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = code;
    throw err;
  }
  return res.json();
}

async function tryDirectGuestPhotoUpload(path: string, formData: FormData) {
  const match = path.match(/^\/api\/bookings\/([^/]+)\/guest-photo$/);
  if (!match) return null;

  const bookingId = match[1];
  const rawFile = formData.get("file");
  if (!(rawFile instanceof Blob)) return null;

  const contentType = rawFile.type || "image/jpeg";

  let presign: any;
  try {
    presign = await postJson(`/api/bookings/${bookingId}/guest-photo/presign`, {
      contentType,
      fileSize: rawFile.size,
    });
  } catch (error: any) {
    const code = String(error?.code || "");
    const status = Number(error?.status || 0);
    const allowFallback = status === 404 || code === "STORAGE_NOT_CONFIGURED";
    if (allowFallback) return null;
    throw error;
  }

  const putHeaders: Record<string, string> = {
    ...(presign?.requiredHeaders || {}),
  };
  if (!putHeaders["Content-Type"]) putHeaders["Content-Type"] = contentType;

  const uploadRes = await fetch(String(presign.uploadUrl), {
    method: String(presign.method || "PUT"),
    headers: putHeaders,
    body: rawFile,
  });
  if (!uploadRes.ok) {
    let details = "";
    try {
      details = (await uploadRes.text()).slice(0, 300);
    } catch {}
    throw new Error(`S3 upload failed (${uploadRes.status})${details ? `: ${details}` : ""}`);
  }

  return postJson(`/api/bookings/${bookingId}/guest-photo/confirm`, {
    photoKey: presign.photoKey,
    mime: contentType,
    size: rawFile.size,
  });
}

export async function apiUpload(path: string, formData: FormData) {
  let directResult: any = null;
  try {
    directResult = await tryDirectGuestPhotoUpload(path, formData);
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("failed to fetch")) {
      throw new Error("S3 upload blocked by network/CORS. Check bucket CORS AllowedOrigins for your frontend domain.");
    }
    throw e;
  }
  if (directResult) return directResult;

  // IMPORTANT: do NOT set Content-Type for FormData
  const res = await fetch(toApiUrl(path), {
    method: "POST",
    body: formData,
    headers: getApiHeaders(),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Upload failed"));
  }

  return res.json();
}

export async function compressToMaxBytes(file: File, maxBytes = 300 * 1024): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });

  const maxW = 720;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.85;

  const toBlob = (q: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
        "image/jpeg",
        q
      );
    });

  let blob = await toBlob(quality);
  while (blob.size > maxBytes && quality > 0.35) {
    quality -= 0.1;
    blob = await toBlob(quality);
  }

  if (blob.size > maxBytes) {
    throw new Error("Could not compress image to 300KB. Try another photo.");
  }

  return blob;
}
