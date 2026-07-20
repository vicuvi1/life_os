"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a number that quickly counts to its new value when it changes
 * (~250ms), instead of jumping instantly. Respects prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const duration = 250;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t); // ease-out
      const cur = from + (value - from) * eased;
      setDisplay(t < 1 ? cur : value);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value]);

  const shown = Number.isInteger(value)
    ? Math.round(display)
    : Math.round(display * 10) / 10;
  return <span className="tabular-nums">{format ? format(shown) : shown}</span>;
}
