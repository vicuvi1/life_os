"use client";

import { useMemo } from "react";
import { addDays } from "@/lib/habits";
import { startOfWeekKey } from "@/lib/dates";
import { formatHours } from "@/lib/sleep";
import { cn } from "@/lib/utils";

const SHADES = ["#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucket(h: number): number {
  if (h < 5) return 0;
  if (h < 6.5) return 1;
  if (h < 7.5) return 2;
  if (h < 8.5) return 3;
  return 4;
}

interface Props {
  hoursByDate: Record<string, number>;
  today: string;
  onSelect?: (date: string) => void;
}

/** GitHub-style 365-day heatmap of nightly sleep duration. */
export function YearHeatmap({ hoursByDate, today, onSelect }: Props) {
  const weeks = useMemo(() => {
    const start = startOfWeekKey(addDays(today, -364));
    const cols: string[][] = [];
    let cur = start;
    while (cur <= today) {
      const col: string[] = [];
      for (let i = 0; i < 7; i++) {
        col.push(cur);
        cur = addDays(cur, 1);
      }
      cols.push(col);
    }
    return cols;
  }, [today]);

  return (
    <div className="flex gap-2 text-[10px] text-muted-foreground">
      {/* Weekday labels */}
      <div className="flex flex-col gap-[3px] pt-[16px]">
        {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
          <span key={i} className="flex h-[11px] items-center leading-none">{d}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        {/* Month labels */}
        <div className="mb-1 flex gap-[3px]">
          {weeks.map((col, i) => {
            const prev = weeks[i - 1]?.[0];
            const m = new Date(`${col[0]}T00:00:00`).getMonth();
            const show = i === 0 || (prev && new Date(`${prev}T00:00:00`).getMonth() !== m);
            return (
              <span key={col[0]} className="w-[11px] shrink-0 whitespace-nowrap">
                {show ? MONTHS[m] : ""}
              </span>
            );
          })}
        </div>
        {/* Grid */}
        <div className="flex gap-[3px]">
          {weeks.map((col) => (
            <div key={col[0]} className="flex flex-col gap-[3px]">
              {col.map((date) => {
                const future = date > today;
                const h = hoursByDate[date];
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={future || !onSelect}
                    onClick={() => onSelect?.(date)}
                    title={future ? "" : `${date} · ${h != null ? formatHours(h) : "no data"}`}
                    className={cn(
                      "h-[11px] w-[11px] rounded-[2px] transition",
                      future ? "opacity-0" : h == null ? "bg-muted/50 hover:ring-1 hover:ring-primary/40" : "hover:ring-1 hover:ring-primary/60",
                      isToday && "ring-1 ring-foreground"
                    )}
                    style={h != null ? { backgroundColor: SHADES[bucket(h)] } : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="mt-2 flex items-center gap-1.5">
          <span>Less sleep</span>
          <span className="h-[11px] w-[11px] rounded-[2px] bg-muted/50" />
          {SHADES.map((s) => (
            <span key={s} className="h-[11px] w-[11px] rounded-[2px]" style={{ backgroundColor: s }} />
          ))}
          <span>More sleep</span>
        </div>
      </div>
    </div>
  );
}
