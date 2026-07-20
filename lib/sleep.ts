type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

/** Rating for hours slept, per the Dependency Tracker guidance (7-9h = good). */
export function hoursRating(hours: number): {
  label: string;
  variant: BadgeVariant;
} {
  if (hours >= 7 && hours <= 9) return { label: "Good", variant: "success" };
  if (hours >= 6 && hours < 7) return { label: "Okay", variant: "warning" };
  if (hours > 9) return { label: "Long", variant: "warning" };
  return { label: "Low", variant: "destructive" };
}

/** Rating for subjective sleep quality (1-10). */
export function qualityRating(q: number): {
  label: string;
  variant: BadgeVariant;
} {
  if (q >= 8) return { label: "Excellent", variant: "success" };
  if (q >= 6) return { label: "Good", variant: "success" };
  if (q >= 4) return { label: "Low", variant: "warning" };
  return { label: "Poor", variant: "destructive" };
}

/** Human-friendly hours, e.g. 7.5 → "7h 30m", 7 → "7h". */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Average hours across logs (0 if none). */
export function averageHours(logs: { hours: number }[]): number {
  if (logs.length === 0) return 0;
  return logs.reduce((s, l) => s + l.hours, 0) / logs.length;
}
