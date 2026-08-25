export function formatAdminDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", ...options }).format(date);
}

export function formatMinutes(minutes) {
  const safeMinutes = Number(minutes || 0);
  if (!safeMinutes) return "—";
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return hours ? `${hours}j ${rest}m` : `${rest}m`;
}
