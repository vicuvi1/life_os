"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator, Minus, CornerDownLeft, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const STORE_KEY = "lifeos:calc";
const MARGIN = 12;
const PANEL_W = 264;
const PANEL_H = 404;

type Op = "+" | "-" | "*" | "/";

interface Persisted {
  x: number;
  y: number;
  open: boolean;
}

function loadState(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi));
}
function round(n: number) {
  // Trim binary float noise without a full decimal library.
  return Math.round((n + Number.EPSILON) * 1e10) / 1e10;
}

export function FloatingCalculator() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Calculator state (kept in memory so minimize/reopen preserves the value).
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [overwrite, setOverwrite] = useState(true);

  // The last numeric field the user focused — where "Insert" sends the result.
  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    const s = loadState();
    if (typeof s.x === "number" && typeof s.y === "number") setPos({ x: s.x, y: s.y });
    if (s.open) setOpen(true);
  }, []);

  // Track the last focused numeric-ish input anywhere in the app.
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-calc-panel]")) return; // ignore the calculator itself
      const isText = t instanceof HTMLTextAreaElement;
      const isInput = t instanceof HTMLInputElement;
      if (!isInput && !isText) return;
      if (isInput) {
        const ty = (t.getAttribute("type") ?? "text").toLowerCase();
        const numericType = ty === "number" || ty === "text" || ty === "tel";
        const im = (t.getAttribute("inputmode") ?? "").toLowerCase();
        if (!numericType && im !== "numeric" && im !== "decimal") return;
      }
      lastInputRef.current = t as HTMLInputElement | HTMLTextAreaElement;
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  const persist = useCallback((next: Partial<Persisted>) => {
    try {
      const cur = loadState();
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...cur, ...next }));
    } catch {
      /* ignore */
    }
  }, []);

  const defaultPos = useCallback(
    () => ({
      x: Math.max(MARGIN, window.innerWidth - PANEL_W - MARGIN),
      y: Math.max(MARGIN, window.innerHeight - PANEL_H - MARGIN),
    }),
    []
  );

  function openPanel() {
    setPos((p) => {
      const next = p ?? defaultPos();
      const clamped = {
        x: clamp(next.x, MARGIN, window.innerWidth - PANEL_W - MARGIN),
        y: clamp(next.y, MARGIN, window.innerHeight - PANEL_H - MARGIN),
      };
      persist(clamped);
      return clamped;
    });
    setOpen(true);
    persist({ open: true });
  }
  function minimize() {
    setOpen(false);
    persist({ open: false });
  }

  // Dragging (panel header) — works while page content scrolls underneath.
  useEffect(() => {
    function move(e: PointerEvent) {
      if (!dragRef.current) return;
      const x = clamp(e.clientX - dragRef.current.dx, MARGIN, window.innerWidth - PANEL_W - MARGIN);
      const y = clamp(e.clientY - dragRef.current.dy, MARGIN, window.innerHeight - PANEL_H - MARGIN);
      setPos({ x, y });
    }
    function up() {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPos((p) => {
        if (p) persist(p);
        return p;
      });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [persist]);

  function startDrag(e: React.PointerEvent) {
    if (!pos) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }

  // ---- Calculator ops -----------------------------------------------------
  function inputDigit(d: string) {
    setDisplay((cur) => (overwrite ? d : cur === "0" ? d : cur + d));
    setOverwrite(false);
  }
  function inputDot() {
    if (overwrite) {
      setDisplay("0.");
      setOverwrite(false);
    } else if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  }
  function clearAll() {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setOverwrite(true);
  }
  function backspace() {
    if (overwrite) return;
    setDisplay((cur) => (cur.length > 1 ? cur.slice(0, -1) : "0"));
  }
  function percent() {
    setDisplay((cur) => String(round(parseFloat(cur || "0") / 100)));
    setOverwrite(true);
  }
  function compute(a: number, b: number, o: Op): number {
    if (o === "+") return a + b;
    if (o === "-") return a - b;
    if (o === "*") return a * b;
    return b === 0 ? NaN : a / b;
  }
  function chooseOp(next: Op) {
    const cur = parseFloat(display);
    if (prev != null && op && !overwrite) {
      const r = compute(prev, cur, op);
      if (Number.isNaN(r)) return clearAll();
      setPrev(round(r));
      setDisplay(String(round(r)));
    } else {
      setPrev(cur);
    }
    setOp(next);
    setOverwrite(true);
  }
  function equals() {
    if (op == null || prev == null) return;
    const r = compute(prev, parseFloat(display), op);
    if (Number.isNaN(r)) {
      clearAll();
      setDisplay("Error");
      return;
    }
    setDisplay(String(round(r)));
    setPrev(null);
    setOp(null);
    setOverwrite(true);
  }

  function insertResult() {
    const el = lastInputRef.current;
    if (!el || display === "Error") return;
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, display);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
  }

  if (!mounted) return null;

  // Collapsed launcher (persistent, bottom-right).
  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        aria-label="Open calculator"
        className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-2xl border bg-card text-foreground shadow-lg transition-transform duration-150 ease-smooth hover:scale-105 active:scale-95"
      >
        <Calculator className="h-5 w-5" />
      </button>
    );
  }

  const btn =
    "flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors duration-100 ease-smooth active:scale-95";
  const digit = cn(btn, "bg-muted hover:bg-accent");
  const opBtn = cn(btn, "bg-primary/10 text-primary hover:bg-primary/20");

  return (
    <div
      data-calc-panel
      style={{ left: pos?.x, top: pos?.y, width: PANEL_W }}
      className="fixed z-[60] select-none rounded-2xl border bg-card shadow-xl"
    >
      {/* Draggable header */}
      <div
        onPointerDown={startDrag}
        className="flex cursor-grab items-center justify-between rounded-t-2xl border-b px-3 py-2 active:cursor-grabbing"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-primary" /> Calculator
        </span>
        <button
          type="button"
          onClick={minimize}
          aria-label="Minimize calculator"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        {/* Display */}
        <div className="mb-3 rounded-lg border bg-background px-3 py-2.5 text-right">
          {op && prev != null && (
            <div className="text-[11px] text-muted-foreground">
              {round(prev)} {op === "*" ? "×" : op === "/" ? "÷" : op}
            </div>
          )}
          <div className="truncate text-2xl font-semibold tabular-nums">{display}</div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" onClick={clearAll} className={cn(btn, "bg-destructive/10 text-destructive hover:bg-destructive/20")}>
            C
          </button>
          <button type="button" onClick={backspace} aria-label="Backspace" className={digit}>
            <Delete className="h-4 w-4" />
          </button>
          <button type="button" onClick={percent} className={opBtn}>
            %
          </button>
          <button type="button" onClick={() => chooseOp("/")} className={opBtn}>
            ÷
          </button>

          {["7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => inputDigit(d)} className={digit}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => chooseOp("*")} className={opBtn}>
            ×
          </button>

          {["4", "5", "6"].map((d) => (
            <button key={d} type="button" onClick={() => inputDigit(d)} className={digit}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => chooseOp("-")} className={opBtn}>
            −
          </button>

          {["1", "2", "3"].map((d) => (
            <button key={d} type="button" onClick={() => inputDigit(d)} className={digit}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => chooseOp("+")} className={opBtn}>
            +
          </button>

          <button type="button" onClick={() => inputDigit("0")} className={cn(digit, "col-span-2")}>
            0
          </button>
          <button type="button" onClick={inputDot} className={digit}>
            .
          </button>
          <button
            type="button"
            onClick={equals}
            className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            =
          </button>
        </div>

        {/* Insert into the focused field */}
        <button
          type="button"
          onClick={insertResult}
          className={cn(
            btn,
            "mt-2 w-full gap-2 border border-primary/40 bg-primary/5 text-primary hover:bg-primary/15"
          )}
        >
          <CornerDownLeft className="h-4 w-4" /> Insert result
        </button>
      </div>
    </div>
  );
}
