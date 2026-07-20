"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number | null;
  /** Called once with the parsed value when the user commits (blur / Enter). */
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  /** Allow decimal entry (default true). */
  decimals?: boolean;
  /** Shown after the number, e.g. "h", "glasses", "min". */
  suffix?: string;
  placeholder?: string;
  /**
   * Render the current value as a muted suggestion (smart default not yet
   * confirmed by the user) instead of a full-color confirmed value.
   */
  suggested?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
}

/**
 * The app-wide "every number is directly typeable" primitive. A compact text
 * field that accepts exact keyboard entry (decimals included), commits on blur
 * or Enter, reverts on Escape, and never fires a request per keystroke.
 * Sliders and +/- steppers elsewhere are shortcuts layered on top of this.
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  decimals = true,
  suffix,
  placeholder,
  suggested = false,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: Props) {
  const [text, setText] = useState(value != null ? String(value) : "");
  const [focused, setFocused] = useState(false);
  const lastValue = useRef(value);

  // Sync from outside (e.g. slider moved) unless the user is mid-edit.
  useEffect(() => {
    if (!focused && value !== lastValue.current) {
      setText(value != null ? String(value) : "");
    }
    lastValue.current = value;
  }, [value, focused]);

  function commit() {
    const raw = text.trim().replace(",", ".");
    if (raw === "") {
      setText(value != null ? String(value) : "");
      return;
    }
    let n = Number(raw);
    if (Number.isNaN(n)) {
      setText(value != null ? String(value) : "");
      return;
    }
    if (!decimals) n = Math.round(n);
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    n = Math.round(n * 100) / 100;
    setText(String(n));
    if (n !== value) onCommit(n);
  }

  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <input
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setText(value != null ? String(value) : "");
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "w-14 rounded-md border border-input bg-background px-1.5 py-1 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          suggested && !focused && "italic text-muted-foreground",
          inputClassName
        )}
      />
      {suffix && (
        <span className="text-xs text-muted-foreground">{suffix}</span>
      )}
    </span>
  );
}
