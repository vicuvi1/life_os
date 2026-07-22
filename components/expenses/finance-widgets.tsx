"use client";

// Presentational + inline-edit widgets extracted from the Finance page to keep
// that page focused on data + orchestration. All are leaf components driven by
// props (no page state), depending only on lib helpers.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categoryColor,
  isTransfer,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABEL,
} from "@/lib/expenses";
import { cn } from "@/lib/utils";
import type { EntryKind, Expense } from "@/lib/types";

export function Panel({
  title,
  children,
  bodyClassName,
  action,
}: {
  title: string;
  children: React.ReactNode;
  bodyClassName?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {action}
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function Delta({ pct, good, suffix }: { pct: number; good: boolean; suffix: string }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-emerald-500" : "text-rose-500")}>
        {pct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(pct).toFixed(1)}%
      </span>
      <span className="text-muted-foreground">{suffix}</span>
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 72, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={up ? "#10b981" : "#f43f5e"}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
  spark,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  spark?: number[];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconClass)}><Icon className="h-4 w-4" /></span>
        {spark && spark.length > 1 && <Sparkline data={spark} />}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-1">{sub}</div>
    </Card>
  );
}

export function QuickAdd({
  icon: Icon,
  label,
  cls,
  iconCls,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  cls: string;
  iconCls: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors", cls)}>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconCls)}><Icon className="h-4 w-4" /></span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export function IncomeExpenseBars({
  income,
  expense,
  net,
  formatAmountDisplay,
}: {
  income: number;
  expense: number;
  net: number;
  currency: unknown;
  formatAmountDisplay: (amount: number) => string;
}) {
  const max = Math.max(income, expense, 1);
  return (
    <div>
      <div className="flex h-40 items-end justify-around gap-6">
        {[
          { label: "Income", value: income, cls: "bg-emerald-500", text: "text-emerald-500" },
          { label: "Expenses", value: expense, cls: "bg-rose-500", text: "text-rose-500" },
        ].map((b) => (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className={cn("text-sm font-semibold tabular-nums", b.text)}>{formatAmountDisplay(b.value)}</span>
            <div className={cn("w-full max-w-[80px] rounded-t transition-all", b.cls)} style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }} />
            <span className="text-xs text-muted-foreground">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Net amount</span>
        <span className={cn("font-semibold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatAmountDisplay(net)}</span>
      </div>
    </div>
  );
}

export function AmountInput({
  value,
  tone,
  onCommit,
}: {
  value: number | null;
  tone: "income" | "expense";
  onCommit: (num: number | null) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const dirty = useRef(false);
  const commitRef = useRef<() => void>(() => {});
  useEffect(() => { if (!dirty.current) setDraft(value != null ? String(value) : ""); }, [value]);
  const commit = useCallback(() => {
    dirty.current = false;
    const raw = draft.trim();
    const num = raw === "" ? null : Number(raw);
    if (num != null && (Number.isNaN(num) || num < 0)) {
      setDraft(value != null ? String(value) : "");
      return;
    }
    const normalized = num && num > 0 ? Math.round(num * 100) / 100 : null;
    if (normalized === (value ?? null)) return;
    onCommit(normalized);
  }, [draft, value, onCommit]);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => commitRef.current(), 800);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dirty.current) commitRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (dirty.current) commitRef.current();
    };
  }, []);
  return (
    <input
      type="number" min={0} step="0.01" inputMode="decimal" value={draft} placeholder="—"
      onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { dirty.current = false; setDraft(value != null ? String(value) : ""); e.currentTarget.blur(); } }}
      className={cn("w-full rounded bg-transparent px-2 py-1 text-right tabular-nums outline-none transition-colors placeholder:text-muted-foreground/30 hover:bg-background/70 focus:bg-background focus:ring-1 focus:ring-primary",
        value != null && (tone === "income" ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-rose-600 dark:text-rose-400"))}
    />
  );
}

export function NoteInput({ entry, onCommit }: { entry: Expense; onCommit: (text: string) => void }) {
  const value = entry.note ?? "";
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const commitRef = useRef<() => void>(() => {});
  useEffect(() => { if (!dirty.current) setDraft(value); }, [value]);
  const commit = useCallback(() => {
    dirty.current = false;
    onCommit(draft);
  }, [draft, onCommit]);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => commitRef.current(), 800);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dirty.current) commitRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (dirty.current) commitRef.current();
    };
  }, []);
  return (
    <input
      type="text" value={draft} placeholder="add note"
      onChange={(e) => { dirty.current = true; setDraft(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { dirty.current = false; setDraft(value); e.currentTarget.blur(); } }}
      className="w-full rounded bg-transparent px-2 py-1 outline-none transition-colors placeholder:text-muted-foreground/30 hover:bg-background/70 focus:bg-background focus:ring-1 focus:ring-primary"
    />
  );
}

export function CategorySelect({
  entry,
  kind,
  onChange,
}: {
  entry: Expense;
  kind: EntryKind;
  onChange: (category: string) => void;
}) {
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const label = (c: string) => kind === "income"
    ? INCOME_CATEGORY_LABEL[c as keyof typeof INCOME_CATEGORY_LABEL] ?? c
    : EXPENSE_CATEGORY_LABEL[c as keyof typeof EXPENSE_CATEGORY_LABEL] ?? c;
  // Transfers aren't a user-pickable category — show a static, non-editable chip.
  if (isTransfer(entry)) {
    return (
      <span className="flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(entry.category) }} />
        Transfer
      </span>
    );
  }
  return (
    <Select value={entry.category} onValueChange={onChange}>
      <SelectTrigger className="h-8 border-transparent bg-transparent px-2 text-sm hover:bg-background/70">
        <span className="flex items-center gap-1.5 truncate">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(entry.category) }} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {cats.map((c) => <SelectItem key={c} value={c}>{label(c)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
