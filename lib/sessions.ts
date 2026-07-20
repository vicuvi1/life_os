import type { Session, SessionCategory } from "@/lib/types";

// Category presets. Colors follow the Smart Calendar spec:
// study=blue family, workout=red, deep work=green, admin=orange, personal=purple.
export const SESSION_CATEGORIES: SessionCategory[] = [
  "study",
  "workout",
  "deep_work",
  "admin",
  "personal",
  "other",
];

export const SESSION_CATEGORY_LABEL: Record<SessionCategory, string> = {
  study: "Study",
  workout: "Workout",
  deep_work: "Deep work",
  admin: "Admin",
  personal: "Personal",
  other: "Other",
};

export const SESSION_CATEGORY_COLOR: Record<SessionCategory, string> = {
  study: "#3b82f6",
  workout: "#ef4444",
  deep_work: "#10b981",
  admin: "#f59e0b",
  personal: "#8b5cf6",
  other: "#64748b",
};

/** Effective display color: custom color if set, else the category color. */
export function sessionColor(s: Pick<Session, "color" | "category">): string {
  return s.color ?? SESSION_CATEGORY_COLOR[s.category];
}

/** "07:00" → 420. Returns null for malformed input. */
export function timeToMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 420 → "07:00" (24h, for <input type="time">). */
export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 420 → "7:00 AM" for display. */
export function minToLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "7:00 AM – 9:00 AM (2h)" style range label. */
export function rangeLabel(startMin: number, endMin: number): string {
  const dur = endMin - startMin;
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  const durStr = m === 0 ? `${h}h` : h === 0 ? `${m}min` : `${h}h ${m}min`;
  return `${minToLabel(startMin)} – ${minToLabel(endMin)} (${durStr})`;
}

/** Two sessions on the same date overlap if their time ranges intersect. */
export function sessionsOverlap(a: Session, b: Session): boolean {
  return a.date === b.date && a.startMin < b.endMin && b.startMin < a.endMin;
}

/** Ids of sessions that overlap at least one other session in the list. */
export function findConflicts(sessions: Session[]): Set<string> {
  const conflicted = new Set<string>();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      if (sessionsOverlap(sessions[i], sessions[j])) {
        conflicted.add(sessions[i].id);
        conflicted.add(sessions[j].id);
      }
    }
  }
  return conflicted;
}

/** Total planned/done minutes in a list of sessions. */
export function totalMinutes(sessions: Session[]): number {
  return sessions.reduce((sum, s) => sum + (s.endMin - s.startMin), 0);
}
