/** Time-of-day greeting. Hour is 0-23 in the viewer's context. */
export function greetingFor(hour: number): string {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Still up?";
}

/** Derive a friendly display name from an email address. */
export function nameFromEmail(email?: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._-]/)[0] ?? local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "there";
}

/** Prefer a set display name (first word); fall back to the email-derived name. */
export function resolveFirstName(
  displayName?: string | null,
  email?: string | null
): string {
  const dn = (displayName ?? "").trim();
  if (dn) return dn.split(/\s+/)[0];
  return nameFromEmail(email);
}

/** Local YYYY-MM-DD string for the given date (used for habit_logs.completed_date). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
