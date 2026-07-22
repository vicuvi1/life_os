"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote as QuoteIcon } from "lucide-react";
import { QUOTES } from "@/lib/quotes";
import { cn } from "@/lib/utils";

const ROTATE_MS = 2 * 60 * 1000; // a fresh quote every 2 minutes

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuoteTicker() {
  // Shuffle once per session so the order feels fresh but back/next is stable.
  const order = useMemo(() => shuffle(QUOTES), []);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on every change so the entrance animation re-triggers.
  const [tick, setTick] = useState(0);

  const go = useCallback(
    (dir: 1 | -1) => {
      setI((p) => (p + dir + order.length) % order.length);
      setTick((t) => t + 1);
    },
    [order.length]
  );

  // Auto-advance every 2 min; pauses on hover so you can finish reading.
  useEffect(() => {
    if (paused || order.length <= 1) return;
    const id = setTimeout(() => go(1), ROTATE_MS);
    return () => clearTimeout(id);
  }, [i, paused, go, order.length]);

  const q = order[i];
  if (!q) return null;

  return (
    <div
      className="group hidden min-w-0 flex-1 items-center justify-center gap-1 px-2 md:flex"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous quote"
        className="shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        key={tick}
        className="animate-quote-in flex min-w-0 items-center gap-2"
        title={q.a ? `${q.t} — ${q.a}` : q.t}
      >
        <QuoteIcon className="hidden h-3.5 w-3.5 shrink-0 text-primary/60 lg:block" />
        <p className="truncate text-sm">
          <span className="italic text-foreground/85">{q.t}</span>
          {q.a && (
            <span className="ml-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
              — {q.a}
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next quote"
        className={cn(
          "shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
