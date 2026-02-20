const nairaFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type AmountInput = string | number | null | undefined;

function parseAmount(value: AmountInput) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

export function formatNaira(value: AmountInput, fallback = "—") {
  const parsed = parseAmount(value);
  if (parsed === null) return fallback;
  return `₦ ${nairaFormatter.format(parsed)}`;
}
