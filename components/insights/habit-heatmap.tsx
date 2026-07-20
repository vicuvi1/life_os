"use client";

import { useMemo } from "react";
import { addDays } from "@/lib/habits";
import { startOfWeekKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface Props {
  /** Completions per date key (YYYY-MM-DD → count). */
  countsByDate: Record<string, number>;
  /** Value that maps to the most-intense color (e.g. number of habits). */
  max: number;
  today: string;
  weeks?: number;
}

const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/30",
  "bg-primary/55",
  "bg-primary/80",
  "bg-primary",
];

function level(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio >= 1) return 4;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
}

export function HabitHeatmap({ countsByDate, max, today, weeks = 13 }: Props) {
  const columns = useMemo(() => {
    const start = startOfWeekKey(addDays(today, -7 * (weeks - 1)));
    const cols: string[][] = [];
    let cur = start;
    for (let w = 0; w < weeks; w++) {
      const col: string[] = [];
      for (let d = 0; d < 7; d++) {
        col.push(cur);
        cur = addDays(cur, 1);
      }
      cols.push(col);
    }
    return cols;
  }, [today, weeks]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((key) => {
              const future = key > today;
              const count = countsByDate[key] ?? 0;
              return (
                <div
                  key={key}
                  title={`${key}: ${count} completed`}
                  className={cn(
                    "h-3 w-3 rounded-[3px]",
                    future ? "bg-transparent" : LEVEL_CLASS[level(count, max)]
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span>Less</span>
        {LEVEL_CLASS.map((c, i) => (
          <span key={i} className={cn("h-3 w-3 rounded-[3px]", c)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
