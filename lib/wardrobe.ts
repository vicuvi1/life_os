import type { ClothingItem, Outfit, WardrobeStatus, WearLog } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status metadata (wash-cycle flow order)
// ---------------------------------------------------------------------------
export const WARDROBE_STATUSES: WardrobeStatus[] = [
  "clean",
  "worn",
  "dirty",
  "washing",
  "drying",
  "ready",
];

export const STATUS_META: Record<
  WardrobeStatus,
  { label: string; color: string; hint: string }
> = {
  clean: { label: "Clean", color: "#10b981", hint: "Unworn since last wash" },
  worn: { label: "Worn", color: "#f59e0b", hint: "Used recently, not dirty yet" },
  dirty: { label: "Dirty", color: "#f43f5e", hint: "Needs a wash" },
  washing: { label: "Washing", color: "#3b82f6", hint: "In the machine" },
  drying: { label: "Drying", color: "#06b6d4", hint: "Hanging / in the dryer" },
  ready: { label: "Ready", color: "#84cc16", hint: "Fresh out of the wash" },
};

/** Statuses in which an item is wearable right now. */
export function isWearable(item: Pick<ClothingItem, "status" | "retired">): boolean {
  return !item.retired && (item.status === "clean" || item.status === "ready" || item.status === "worn");
}

// ---------------------------------------------------------------------------
// Default (user-extensible) tag suggestions — never a locked enum.
// ---------------------------------------------------------------------------
export const DEFAULT_CATEGORIES = [
  "Tops",
  "Bottoms",
  "Footwear",
  "Outerwear",
  "Accessories",
  "Socks",
  "Underwear",
];
export const DEFAULT_SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
export const DEFAULT_STYLES = ["Casual", "Sport", "Formal", "Business", "Streetwear"];
export const DEFAULT_OCCASIONS = [
  "University",
  "Gym",
  "Office",
  "Casual",
  "Rainy Day",
  "Summer",
  "Travel",
  "Formal",
  "Night Out",
];

/** Every category present in the wardrobe (defaults + whatever the user typed). */
export function categoriesInUse(items: ClothingItem[]): string[] {
  const set = new Set<string>();
  for (const i of items) if (i.category) set.add(i.category);
  // Show defaults first (only ones that exist or all when empty), then customs.
  const customs = Array.from(set).filter((c) => !DEFAULT_CATEGORIES.includes(c)).sort();
  const defaults = DEFAULT_CATEGORIES.filter((c) => set.has(c));
  return [...defaults, ...customs];
}

// ---------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------
/** price / timesWorn — only meaningful once both exist. */
export function costPerWear(item: Pick<ClothingItem, "cost" | "timesWorn">): number | null {
  if (item.cost == null || item.cost <= 0 || item.timesWorn <= 0) return null;
  return Math.round((item.cost / item.timesWorn) * 100) / 100;
}

/** Count of items per status (active items only). */
export function statusCounts(items: ClothingItem[]): Record<WardrobeStatus, number> & { needsIroning: number } {
  const out = { clean: 0, worn: 0, dirty: 0, washing: 0, drying: 0, ready: 0, needsIroning: 0 };
  for (const i of items) {
    if (i.retired) continue;
    out[i.status]++;
    if (i.needsIroning) out.needsIroning++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------------
export interface WardrobeFilter {
  query?: string;
  category?: string | null; // null/undefined = all
  status?: WardrobeStatus | "needsIroning" | null;
  /** A season name — items tagged with other seasons are hidden; untagged items count as all-season. */
  season?: string | null;
  includeRetired?: boolean;
}

export function filterItems(items: ClothingItem[], f: WardrobeFilter): ClothingItem[] {
  const q = (f.query ?? "").trim().toLowerCase();
  return items.filter((i) => {
    if (!f.includeRetired && i.retired) return false;
    if (f.category && i.category !== f.category) return false;
    if (f.status === "needsIroning") {
      if (!i.needsIroning) return false;
    } else if (f.status && i.status !== f.status) {
      return false;
    }
    // Season: untagged items are treated as all-season (always shown).
    if (f.season && i.seasons.length > 0 && !i.seasons.includes(f.season)) return false;
    if (!q) return true;
    const hay = [i.name, i.brand ?? "", i.color ?? "", i.category ?? "", ...i.tags, ...i.styles, ...i.seasons]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

// ---------------------------------------------------------------------------
// Wear-log helpers
// ---------------------------------------------------------------------------
/** The log entry for a given YYYY-MM-DD date, if any. */
export function wearForDate(wears: WearLog[], date: string): WearLog | undefined {
  return wears.find((w) => w.date === date);
}

/** Items sorted by most-recently worn (for the Recently Worn strip). */
export function recentlyWorn(items: ClothingItem[], limit = 10): ClothingItem[] {
  return items
    .filter((i) => i.lastWorn != null)
    .sort((a, b) => (a.lastWorn! < b.lastWorn! ? 1 : -1))
    .slice(0, limit);
}

/** Resolve an outfit's items in order, skipping any that were deleted. */
export function outfitItems(outfit: Pick<Outfit, "itemIds">, items: ClothingItem[]): ClothingItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return outfit.itemIds.map((id) => byId.get(id)).filter((i): i is ClothingItem => Boolean(i));
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------
/** Active items sorted by wear count (descending); ties keep name order. */
export function byWearCount(items: ClothingItem[], dir: "most" | "least"): ClothingItem[] {
  const active = items.filter((i) => !i.retired);
  const sign = dir === "most" ? -1 : 1;
  return [...active].sort((a, b) => sign * (a.timesWorn - b.timesWorn) || a.name.localeCompare(b.name));
}

/** Active items ranked by cost-per-wear (only those with a price AND ≥1 wear). */
export function costPerWearRanking(items: ClothingItem[]): { item: ClothingItem; cpw: number }[] {
  const out: { item: ClothingItem; cpw: number }[] = [];
  for (const i of items) {
    if (i.retired) continue;
    const cpw = costPerWear(i);
    if (cpw != null) out.push({ item: i, cpw });
  }
  return out.sort((a, b) => a.cpw - b.cpw);
}

/** Active items never worn (candidates to wear or let go). */
export function neverWorn(items: ClothingItem[]): ClothingItem[] {
  return items.filter((i) => !i.retired && i.timesWorn <= 0);
}

/** Total known value of the active wardrobe (sum of item prices). */
export function wardrobeValue(items: ClothingItem[]): number {
  return items.reduce((sum, i) => (!i.retired && i.cost ? sum + i.cost : sum), 0);
}

/** Item count per category among active items (highest first). */
export function categoryBreakdown(items: ClothingItem[]): { category: string; count: number }[] {
  const map = new Map<string, number>();
  for (const i of items) {
    if (i.retired) continue;
    const key = i.category || "Uncategorized";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map, ([category, count]) => ({ category, count })).sort(
    (a, b) => b.count - a.count || a.category.localeCompare(b.category)
  );
}

/** Default categories with no active item — honest gaps, never invented. */
export function categoryGaps(items: ClothingItem[]): string[] {
  const present = new Set(items.filter((i) => !i.retired && i.category).map((i) => i.category as string));
  return DEFAULT_CATEGORIES.filter((c) => !present.has(c));
}

/** Default occasions with no saved outfit. */
export function occasionGaps(outfits: Outfit[]): string[] {
  const covered = new Set(outfits.flatMap((o) => o.occasions));
  return DEFAULT_OCCASIONS.filter((o) => !covered.has(o));
}

/** Count of confirmed (not merely planned) wear days within a YYYY-MM prefix. */
export function wearDaysInMonth(wears: WearLog[], ym: string): number {
  return wears.filter((w) => !w.planned && w.date.startsWith(ym)).length;
}

// ---------------------------------------------------------------------------
// Calendar (Monday-first month grid, matching the rest of the app)
// ---------------------------------------------------------------------------
export interface CalendarCell {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  /** false when the cell belongs to the leading/trailing month padding. */
  inMonth: boolean;
}

/** Build a 6-row × 7-col Monday-first grid covering `year`/`month` (0-based month). */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  // JS: 0=Sun … 6=Sat → shift so Monday is column 0.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({ date: key, day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------
/** Northern-hemisphere season for a date (defaults to now). */
export function currentSeason(date: Date = new Date()): string {
  const m = date.getMonth(); // 0-11
  if (m === 11 || m <= 1) return "Winter";
  if (m <= 4) return "Spring";
  if (m <= 7) return "Summer";
  return "Autumn";
}

/** Seasons actually tagged on active items, ordered by the standard calendar. */
export function seasonsInUse(items: ClothingItem[]): string[] {
  const set = new Set<string>();
  for (const i of items) if (!i.retired) for (const s of i.seasons) set.add(s);
  const ordered = DEFAULT_SEASONS.filter((s) => set.has(s));
  const extra = Array.from(set).filter((s) => !DEFAULT_SEASONS.includes(s)).sort();
  return [...ordered, ...extra];
}

// ---------------------------------------------------------------------------
// Outfit randomizer ("Surprise me")
// ---------------------------------------------------------------------------
/** Core categories a full outfit tries to cover, in display order. */
export const CORE_CATEGORIES = ["Tops", "Bottoms", "Footwear", "Outerwear"];

/**
 * Assemble a random wearable outfit: one item per core category that has any
 * wearable option, optionally constrained to a season. Falls back gracefully
 * when categories are missing. Pure given the RNG, so callers control shuffling.
 */
export function surpriseOutfit(
  items: ClothingItem[],
  opts?: { season?: string | null; rng?: () => number }
): ClothingItem[] {
  const rng = opts?.rng ?? Math.random;
  const pool = items.filter((i) => {
    if (!isWearable(i)) return false;
    if (opts?.season && i.seasons.length > 0 && !i.seasons.includes(opts.season)) return false;
    return true;
  });
  const pick = (list: ClothingItem[]) => (list.length ? list[Math.floor(rng() * list.length)] : null);
  const chosen: ClothingItem[] = [];
  const used = new Set<string>();
  for (const cat of CORE_CATEGORIES) {
    const inCat = pool.filter((i) => i.category === cat && !used.has(i.id));
    const picked = pick(inCat);
    if (picked) {
      chosen.push(picked);
      used.add(picked.id);
    }
  }
  // If nothing matched core categories (all uncategorized), pick a few at random.
  if (chosen.length === 0) {
    const shuffled = [...pool].sort(() => rng() - 0.5).slice(0, 3);
    return shuffled;
  }
  return chosen;
}
