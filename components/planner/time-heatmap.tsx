"use client";

import { useEffect, useMemo, useRef } from "react";
import { addDays } from "@/lib/habits";
import { formatLongDate, startOfWeekKey } from "@/lib/dates";
import { minutesLabel } from "@/lib/planner";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEVELS = [0, 0.3, 0.5, 0.75, 1];

function level(min: number): number {
  if (min <= 0) return 0;
  if (min < 30) return 1;
  if (min < 60) return 2;
  if (min < 120) return 3;
  return 4;
}

interface Props {
  year: number;
  /** Minutes spent per local day. */
  minutesByDate: Map<string, number>;
  /** Hex color for the squares (e.g. the selected goal's color). */
  color: string;
  today: string;
}

/** One square per day of the year — darker means more time spent. */
export function TimeHeatmap({ year, minutesByDate, color, today }: Props) {
  const weeks = useMemo(() => {
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    const cols: (string | null)[][] = [];
    let cur = startOfWeekKey(first);
    while (cur <= last) {
      const col: (string | null)[] = [];
      for (let i = 0; i < 7; i++) {
        col.push(cur >= first && cur <= last ? cur : null);
        cur = addDays(cur, 1);
      }
      cols.push(col);
    }
    return cols;
  }, [year]);

  // Open on the current week when the year doesn't fit the screen.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const idx = weeks.findIndex((col) => col.includes(today));
    if (idx < 0) return;
    el.scrollLeft = Math.max(0, (idx / weeks.length) * el.scrollWidth - el.clientWidth * 0.7);
  }, [weeks, today]);

  return (
    <div ref={scroller} className="overflow-x-auto">
      <div className="inline-block min-w-max">
        <div className="mb-1 flex text-[10px] text-muted-foreground">
          {weeks.map((col, i) => {
            const firstDay = col.find((d) => d != null);
            const prev = i > 0 ? weeks[i - 1].find((d) => d != null) : undefined;
            // Label the first column of each month.
            const isMonthStart =
              firstDay != null && (prev == null || prev.slice(5, 7) !== firstDay.slice(5, 7));
            return (
              <span key={i} className="w-[14px] shrink-0">
                {isMonthStart && firstDay ? MONTHS[Number(firstDay.slice(5, 7)) - 1] : ""}
              </span>
            );
          })}
        </div>
        <div className="flex gap-[2px]">
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col gap-[2px]">
              {col.map((date, j) => {
                if (!date) return <span key={j} className="h-3 w-3" />;
                const min = minutesByDate.get(date) ?? 0;
                const lv = level(min);
                return (
                  <span
                    key={j}
                    title={`${formatLongDate(date)}: ${min > 0 ? minutesLabel(min) : "no time logged"}`}
                    className="h-3 w-3 rounded-[3px] bg-muted"
                    style={{
                      ...(lv > 0 ? { backgroundColor: color, opacity: LEVELS[lv] } : {}),
                      ...(date === today ? { outline: "1px solid hsl(var(--foreground))" } : {}),
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          Less
          {LEVELS.map((o, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-[3px] bg-muted"
              style={i > 0 ? { backgroundColor: color, opacity: o } : undefined}
            />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
