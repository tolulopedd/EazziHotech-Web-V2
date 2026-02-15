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

export async function apiUpload(path: string, formData: FormData) {
  const token = getAuthToken();
  const tenantId = getTenantId();

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (tenantId) headers["x-tenant-id"] = tenantId;

  // IMPORTANT: do NOT set Content-Type for FormData
  const res = await fetch(toApiUrl(path), {
    method: "POST",
    body: formData,
    headers,
  });

  if (!res.ok) {
    let msg = "Upload failed";
    try {
      const j = await res.json();
      msg = j?.error?.message || j?.message || msg;
    } catch {}
    throw new Error(msg);
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
