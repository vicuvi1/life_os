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

// ---------------------------------------------------------------------------
// Smart defaults — learn the user's usual times from their history.
// ---------------------------------------------------------------------------
export interface TimeBlock {
  startMin: number;
  endMin: number;
}

export interface SessionDefaults {
  /** The category the user schedules most often. */
  category: SessionCategory | null;
  /** The usual time block per category. */
  byCategory: Partial<Record<SessionCategory, TimeBlock>>;
  /** The usual category + time block per (normalized) title. */
  byTitle: Record<string, TimeBlock & { category: SessionCategory }>;
}

/** Most-frequent (start,end) block in a list; ties broken by most recent. */
function topBlock(list: Session[]): TimeBlock | null {
  if (list.length === 0) return null;
  const counts = new Map<
    string,
    { count: number; latest: number; startMin: number; endMin: number }
  >();
  for (const s of list) {
    const key = `${s.startMin}_${s.endMin}`;
    const cur = counts.get(key);
    if (cur) {
      cur.count += 1;
      cur.latest = Math.max(cur.latest, s.createdAt);
    } else {
      counts.set(key, {
        count: 1,
        latest: s.createdAt,
        startMin: s.startMin,
        endMin: s.endMin,
      });
    }
  }
  let best: TimeBlock | null = null;
  let bestCount = 0;
  let bestLatest = -1;
  for (const v of Array.from(counts.values())) {
    if (v.count > bestCount || (v.count === bestCount && v.latest > bestLatest)) {
      bestCount = v.count;
      bestLatest = v.latest;
      best = { startMin: v.startMin, endMin: v.endMin };
    }
  }
  return best;
}

function modeCategory(list: Session[]): SessionCategory | null {
  const counts = new Map<SessionCategory, number>();
  for (const s of list) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  let best: SessionCategory | null = null;
  let bestN = 0;
  for (const [c, n] of Array.from(counts.entries())) {
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  }
  return best;
}

export function computeSessionDefaults(sessions: Session[]): SessionDefaults {
  if (sessions.length === 0) {
    return { category: null, byCategory: {}, byTitle: {} };
  }

  const byCategory: Partial<Record<SessionCategory, TimeBlock>> = {};
  for (const c of SESSION_CATEGORIES) {
    const b = topBlock(sessions.filter((s) => s.category === c));
    if (b) byCategory[c] = b;
  }

  const titleGroups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.title.trim().toLowerCase();
    if (!key) continue;
    const arr = titleGroups.get(key) ?? [];
    arr.push(s);
    titleGroups.set(key, arr);
  }
  const byTitle: Record<string, TimeBlock & { category: SessionCategory }> = {};
  for (const [key, list] of Array.from(titleGroups.entries())) {
    const b = topBlock(list);
    if (b) {
      byTitle[key] = { ...b, category: modeCategory(list) ?? list[0].category };
    }
  }

  return { category: modeCategory(sessions), byCategory, byTitle };
}

