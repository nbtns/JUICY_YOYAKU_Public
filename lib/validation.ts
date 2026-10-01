export function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeEmail(value: unknown) {
  const email = normalizeText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function normalizePhone(value: unknown) {
  const phone = normalizeText(value, 30).replace(/[^0-9+()-]/g, "");
  return phone.length >= 8 ? phone : "";
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
