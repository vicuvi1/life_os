import { COLLECTIONS } from "@/lib/types";
import type { RetentionPolicy, StorageSnapshot } from "@/lib/types";

// Firestore Spark (free) plan includes ~1 GiB of stored data.
export const FREE_TIER_BYTES = 1024 * 1024 * 1024;
// Rough overage price after the free tier (~$0.18 / GiB-month in most regions).
export const OVERAGE_PER_GIB_MONTH = 0.18;

// --- byte estimation --------------------------------------------------------
// Approximates Firestore's documented per-document sizing. It counts DOCUMENT
// DATA only — real *billed* storage is higher because it also includes index
// entries. Treat every number here as an estimate of your own data footprint.

function utf8Len(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // surrogate pair
    else n += 3;
  }
  return n;
}

function fieldValueBytes(v: unknown): number {
  if (v === null || v === undefined) return 1;
  const t = typeof v;
  if (t === "boolean") return 1;
  if (t === "number") return 8;
  if (t === "string") return utf8Len(v as string) + 1;
  if (Array.isArray(v)) return v.reduce((s, e) => s + fieldValueBytes(e), 0);
  if (t === "object") {
    const o = v as Record<string, unknown>;
    // Firestore Timestamp / GeoPoint etc. expose toMillis / typed shapes.
    if (typeof (o as { toMillis?: unknown }).toMillis === "function") return 8;
    if (typeof (o as { seconds?: unknown }).seconds === "number") return 8;
    return Object.entries(o).reduce((s, [k, val]) => s + utf8Len(k) + 1 + fieldValueBytes(val), 0);
  }
  return 8;
}

/** Estimated on-disk size (bytes) of one document's data, incl. name + overhead. */
export function estimateDocBytes(id: string, data: Record<string, unknown>): number {
  let size = 32; // per-document overhead
  size += utf8Len(id) + 16; // document name (approx)
  for (const [k, v] of Object.entries(data)) {
    size += utf8Len(k) + 1 + fieldValueBytes(v);
  }
  return size;
}

// --- collection metadata ----------------------------------------------------
export const COLLECTION_LABEL: Record<string, string> = {
  goals: "Goals",
  projects: "Projects",
  tasks: "Tasks",
  habits: "Habits",
  habitLogs: "Habit logs",
  weeklyReviews: "Weekly reviews",
  sessions: "Sessions",
  sleepLogs: "Sleep logs",
  nutritionLogs: "Nutrition logs",
  expenses: "Finance entries",
  budgets: "Budget & recurring",
  meals: "Meal library",
  mealPlan: "Meal plan",
  shoppingChecks: "Shopping lists",
  decisions: "Routines",
  trackers: "Trackers",
  trackerLogs: "Tracker logs",
  clothing: "Wardrobe",
  prefs: "Preferences",
};

export function collectionLabel(name: string): string {
  return COLLECTION_LABEL[name] ?? name;
}

/** Per-collection usage in a scan. */
export interface CollectionUsage {
  name: string;
  label: string;
  count: number;
  bytes: number;
  protectedForever: boolean;
}

/** Result of scanning the user's entire data footprint. */
export interface UsageScan {
  at: number;
  totalBytes: number;
  totalDocs: number;
  collections: CollectionUsage[];
  /** Raw docs per collection, so cleanup/export need no extra reads. */
  raw: Record<string, { id: string; data: Record<string, unknown> }[]>;
}

/** Collections that must NEVER be auto-deleted (config, archives, financial). */
export const PROTECTED_COLLECTIONS = new Set<string>([
  COLLECTIONS.goals,
  COLLECTIONS.projects,
  COLLECTIONS.tasks,
  COLLECTIONS.habits,
  COLLECTIONS.expenses,
  COLLECTIONS.budgets,
  COLLECTIONS.meals,
  COLLECTIONS.decisions,
  COLLECTIONS.trackers,
  COLLECTIONS.clothing,
  COLLECTIONS.prefs,
]);

export function isProtectedCollection(name: string): boolean {
  return PROTECTED_COLLECTIONS.has(name);
}

/** A log-like collection that is safe to trim on a retention schedule. */
export interface RetentionTarget {
  collection: string;
  label: string;
  /** Field holding the YYYY-MM-DD cutoff date for "older than". */
  dateField: string;
  defaultDays: number;
  reason: string;
}

export const RETENTION_TARGETS: RetentionTarget[] = [
  { collection: COLLECTIONS.habitLogs, label: "Habit logs", dateField: "completedDate", defaultDays: 90, reason: "Streaks live on the habit itself; old daily check-ins aren't needed." },
  { collection: COLLECTIONS.sessions, label: "Sessions", dateField: "date", defaultDays: 180, reason: "Keep about six months of session history." },
  { collection: COLLECTIONS.sleepLogs, label: "Sleep logs", dateField: "date", defaultDays: 180, reason: "Keep about six months of nightly logs." },
  { collection: COLLECTIONS.nutritionLogs, label: "Nutrition logs", dateField: "date", defaultDays: 60, reason: "Recent nutrition is what matters day to day." },
  { collection: COLLECTIONS.mealPlan, label: "Meal plan history", dateField: "date", defaultDays: 60, reason: "Past meal-plan days aren't needed once cooked." },
  { collection: COLLECTIONS.trackerLogs, label: "Tracker logs", dateField: "date", defaultDays: 365, reason: "Keep a full year of custom-tracker history." },
  { collection: COLLECTIONS.shoppingChecks, label: "Shopping lists", dateField: "weekStart", defaultDays: 90, reason: "Old weekly shopping state is disposable." },
  { collection: COLLECTIONS.weeklyReviews, label: "Weekly reviews", dateField: "weekStart", defaultDays: 730, reason: "Reflective notes — keep a couple of years." },
];

export function retentionTarget(collection: string): RetentionTarget | undefined {
  return RETENTION_TARGETS.find((t) => t.collection === collection);
}

/** Default (all-disabled) policies, one per retention target. */
export function defaultPolicies(): RetentionPolicy[] {
  return RETENTION_TARGETS.map((t) => ({ collection: t.collection, days: t.defaultDays, enabled: false, lastRun: null }));
}

/** Merge stored policies over the defaults so new targets always appear. */
export function mergePolicies(stored: RetentionPolicy[] | undefined): RetentionPolicy[] {
  const byId = new Map((stored ?? []).map((p) => [p.collection, p]));
  return RETENTION_TARGETS.map((t) => {
    const s = byId.get(t.collection);
    return {
      collection: t.collection,
      days: typeof s?.days === "number" && s.days > 0 ? s.days : t.defaultDays,
      enabled: s?.enabled === true,
      lastRun: typeof s?.lastRun === "number" ? s.lastRun : null,
    };
  });
}

// --- date + cutoff helpers --------------------------------------------------
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD for `days` before `now`. */
export function cutoffDateKey(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Docs whose `dateField` (a YYYY-MM-DD string) is strictly before `cutoffKey`. */
export function idsBefore(
  docs: { id: string; data: Record<string, unknown> }[],
  dateField: string,
  cutoffKey: string
): { id: string; data: Record<string, unknown> }[] {
  return docs.filter((d) => {
    const v = d.data[dateField];
    if (typeof v !== "string" || v.length < 10) return false; // no usable date → keep (safe)
    return v < cutoffKey;
  });
}

/** Docs whose cutoff date is strictly older than `days` ago. */
export function idsOlderThan(
  docs: { id: string; data: Record<string, unknown> }[],
  dateField: string,
  days: number,
  now: Date
): { id: string; data: Record<string, unknown> }[] {
  return idsBefore(docs, dateField, cutoffDateKey(now, days));
}

// --- formatting -------------------------------------------------------------
export function formatBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// --- growth / projection ----------------------------------------------------
export interface GrowthEstimate {
  /** Bytes added per 30 days (can be negative if shrinking). */
  perMonth: number;
  /** Days of history the estimate is based on. */
  spanDays: number;
  enoughData: boolean;
}

export function estimateGrowth(snapshots: StorageSnapshot[]): GrowthEstimate {
  if (snapshots.length < 2) return { perMonth: 0, spanDays: 0, enoughData: false };
  const sorted = [...snapshots].sort((a, b) => a.at - b.at);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanDays = (last.at - first.at) / 86_400_000;
  if (spanDays < 0.5) return { perMonth: 0, spanDays, enoughData: false };
  const perDay = (last.totalBytes - first.totalBytes) / spanDays;
  return { perMonth: perDay * 30, spanDays, enoughData: true };
}

/** Months until `total` grows to `FREE_TIER_BYTES` at `perMonth` (null if never). */
export function monthsToFreeTier(total: number, perMonth: number): number | null {
  if (perMonth <= 0) return null;
  if (total >= FREE_TIER_BYTES) return 0;
  return (FREE_TIER_BYTES - total) / perMonth;
}
