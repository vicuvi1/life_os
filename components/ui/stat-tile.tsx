import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatTone = "default" | "amber" | "emerald" | "rose" | "violet";

const TONE: Record<StatTone, string> = {
  default: "",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  rose: "text-rose-500",
  violet: "text-violet-500",
};

/** A compact labelled metric tile used across dashboards (Goals, Today, …). */
export function StatTile({
  icon: Icon,
  label,
  value,
  tone = "default",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-3", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", TONE[tone])}>{value}</p>
    </div>
  );
}
