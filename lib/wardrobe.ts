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
