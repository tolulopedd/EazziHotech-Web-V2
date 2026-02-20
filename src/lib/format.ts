const lagosDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const lagosDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const integerFormatter = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 0,
});

export function formatDateLagos(value?: string | Date | null, fallback = "—") {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const parts = lagosDateFormatter.formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = (parts.find((p) => p.type === "month")?.value ?? "").toUpperCase();
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  if (!day || !month || !year) return fallback;
  return `${day}-${month}-${year}`;
}

export function formatDateTimeLagos(value?: string | Date | null, fallback = "—") {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return lagosDateTimeFormatter.format(d);
}

export function formatInteger(value?: number | string | null, fallback = "0") {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return integerFormatter.format(Math.trunc(n));
}

export function shortId(value?: string | null, size = 8) {
  if (!value) return "—";
  const clean = String(value).trim();
  if (!clean) return "—";
  return clean.length <= size ? clean.toUpperCase() : clean.slice(-size).toUpperCase();
}
