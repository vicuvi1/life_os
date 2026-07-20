import {
  Activity,
  BookOpen,
  Brain,
  Briefcase,
  Coffee,
  Droplet,
  Dumbbell,
  Heart,
  PenLine,
  Sun,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { Tracker, TrackerType } from "@/lib/types";

export const TRACKER_TYPES: { key: TrackerType; label: string; hint: string }[] = [
  { key: "number", label: "Number", hint: "Any value, decimals ok (e.g. weight 82.3)" },
  { key: "count", label: "Count", hint: "Whole-number tally (e.g. job applications)" },
  { key: "duration", label: "Duration", hint: "Minutes (e.g. 30 min meditation)" },
  { key: "yesno", label: "Yes / No", hint: "Did it happen today?" },
];

/** Icon choices offered when creating a tracker; stored by key. */
export const TRACKER_ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  book: BookOpen,
  brain: Brain,
  briefcase: Briefcase,
  coffee: Coffee,
  droplet: Droplet,
  dumbbell: Dumbbell,
  heart: Heart,
  pen: PenLine,
  sun: Sun,
  target: Target,
  timer: Timer,
};

export const DEFAULT_TRACKER_ICON = "activity";

export function trackerIcon(key: string): LucideIcon {
  return TRACKER_ICONS[key] ?? Activity;
}

/** Display a logged value with the tracker's unit. */
export function formatTrackerValue(t: Tracker, value: number): string {
  if (t.type === "yesno") return value >= 1 ? "Yes" : "No";
  const v = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  const unit = t.type === "duration" ? (t.unit ?? "min") : t.unit;
  return unit ? `${v} ${unit}` : v;
}

/** Whether a logged value satisfies the tracker's daily target. */
export function trackerValueMeetsTarget(t: Tracker, value: number): boolean {
  if (t.type === "yesno") return value >= 1;
  if (t.target == null) return true; // no target — any log counts as done
  return value >= t.target;
}

/** Step used by steppers/sliders per tracker type. */
export function trackerStep(t: Tracker): number {
  return t.type === "number" ? 0.5 : 1;
}
