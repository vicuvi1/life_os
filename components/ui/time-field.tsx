"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  /** "HH:mm" or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  /** Minute granularity for the dropdown (default 5). */
  step?: number;
  ariaLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

/** Two fast dropdowns (hour + minute) instead of a fiddly native time input. */
export function TimeField({ value, onChange, step = 5, ariaLabel }: Props) {
  const [h = "", m = ""] = value ? value.split(":") : [];

  const minutes = useMemo(() => {
    const base: string[] = [];
    for (let i = 0; i < 60; i += step) base.push(String(i).padStart(2, "0"));
    // Keep an off-grid current minute (e.g. an imported 22:34) selectable.
    if (m && !base.includes(m)) base.push(m);
    return base.sort();
  }, [step, m]);

  function emit(nextH: string, nextM: string) {
    if (nextH && nextM) onChange(`${nextH}:${nextM}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={h} onValueChange={(hh) => emit(hh, m || "00")}>
        <SelectTrigger className="h-9 flex-1" aria-label={ariaLabel ? `${ariaLabel} hour` : "Hour"}>
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {HOURS.map((hh) => <SelectItem key={hh} value={hh}>{hh}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={m} onValueChange={(mm) => emit(h || "22", mm)}>
        <SelectTrigger className="h-9 flex-1" aria-label={ariaLabel ? `${ariaLabel} minute` : "Minute"}>
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-56">
          {minutes.map((mm) => <SelectItem key={mm} value={mm}>{mm}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
