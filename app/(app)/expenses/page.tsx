"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  PiggyBank,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getExpenses,
  getBudget,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import {
  monthKey,
  inMonth,
  monthLabel,
  daysInMonth,
  totalEarned,
  totalSpent,
  netTotal,
  accountBalance,
  ACCOUNTS,
  ACCOUNT_LABEL,
} from "@/lib/expenses";
import { entriesToCsv, downloadCsv } from "@/lib/export";
import { resolveCurrency, formatAmount } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BudgetFormDialog } from "@/components/expenses/budget-form-dialog";
import { cn } from "@/lib/utils";
import type { AccountKey, Budget, EntryKind, Expense } from "@/lib/types";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FinancePage() {
  const { user } = useAuth();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<AccountKey>("wallet");

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!user) return;
      if (!opts?.quiet) setLoading(true);
      try {
        const [ex, bg] = await Promise.all([
          getExpenses(user.uid),
          getBudget(user.uid),
        ]);
        setExpenses(ex);
        setBudget(bg);
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    load();
  }, [load]);

  const currency = resolveCurrency(budget);
  const mKey = monthKey(year, month);
  const todayKey = toDateKey(now);

  const monthExpenses = useMemo(
    () => expenses.filter((e) => inMonth(e.date, mKey)),
    [expenses, mKey]
  );

  const earned = useMemo(() => totalEarned(monthExpenses), [monthExpenses]);
  const spent = useMemo(() => totalSpent(monthExpenses), [monthExpenses]);
  const net = useMemo(() => netTotal(monthExpenses), [monthExpenses]);

  // One bucket of income / expense entries per calendar day.
  const byDay = useMemo(() => {
    const m = new Map<string, { income: Expense[]; expense: Expense[] }>();
    for (const e of monthExpenses) {
      const b = m.get(e.date) ?? { income: [], expense: [] };
      (e.kind === "income" ? b.income : b.expense).push(e);
      m.set(e.date, b);
    }
    return m;
  }, [monthExpenses]);

  const accounts = useMemo(
    () =>
      ACCOUNTS.map((a) => ({
        key: a,
        balance: accountBalance(expenses, a, budget?.openingBalances?.[a] ?? 0),
      })),
    [expenses, budget]
  );
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);

  // --- Inline cell mutations (optimistic; resync on error) -------------------
  async function commitAmount(
    dateKey: string,
    kind: EntryKind,
    entries: Expense[],
    num: number | null
  ) {
    if (!user) return;
    const existing = entries[0];
    try {
      if (num == null) {
        if (existing) {
          setExpenses((prev) => prev.filter((x) => x.id !== existing.id));
          await deleteExpense(existing.id);
        }
        return;
      }
      if (existing) {
        setExpenses((prev) =>
          prev.map((x) => (x.id === existing.id ? { ...x, amount: num } : x))
        );
        await updateExpense(existing.id, { amount: num });
      } else {
        const draft = {
          kind,
          amount: num,
          account: newAccount,
          category: "other",
          note: null,
          date: dateKey,
        };
        const id = await createExpense(user.uid, draft);
        setExpenses((prev) => [
          ...prev,
          { id, userId: user.uid, createdAt: Date.now(), ...draft },
        ]);
      }
    } catch {
      await load({ quiet: true });
    }
  }

  async function commitNote(entries: Expense[], text: string) {
    const existing = entries[0];
    if (!existing) return; // enter an amount first
    const note = text.trim() || null;
    if (note === (existing.note ?? null)) return;
    setExpenses((prev) =>
      prev.map((x) => (x.id === existing.id ? { ...x, note } : x))
    );
    try {
      await updateExpense(existing.id, { note });
    } catch {
      await load({ quiet: true });
    }
  }

  function exportCsv(scope: "month" | "all") {
    const data = scope === "month" ? monthExpenses : expenses;
    if (data.length === 0) return;
    const name = scope === "month" ? `finance-${mKey}.csv` : "finance-all.csv";
    downloadCsv(name, entriesToCsv(data));
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const dim = daysInMonth(year, month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const budgetCap = budget?.monthlyTotal ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Finance</h1>
          <p className="text-muted-foreground">
            Type earned and spent straight into the grid — totals update
            themselves.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCsv("month")}>
                This month (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv("all")}>
                All time (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            aria-label="Budget & accounts settings"
            onClick={() => setBudgetOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-medium">{monthLabel(year, month)}</p>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setYear(now.getFullYear());
                setMonth(now.getMonth());
              }}
            >
              This month
            </Button>
          )}
          <Button variant="outline" size="icon" aria-label="Next month" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Compact summary strip */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 text-sm">
        <span>
          Earned{" "}
          <b className="tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatAmount(earned, currency)}
          </b>
        </span>
        <span>
          Spent{" "}
          <b className="tabular-nums text-destructive">
            {formatAmount(spent, currency)}
          </b>
        </span>
        <span>
          Net{" "}
          <b
            className={cn(
              "tabular-nums",
              net >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            )}
          >
            {formatAmount(net, currency)}
          </b>
        </span>
        {budgetCap != null && (
          <span className="text-muted-foreground">
            Budget{" "}
            <b
              className={cn(
                "tabular-nums",
                spent > budgetCap ? "text-destructive" : "text-foreground"
              )}
            >
              {formatAmount(spent, currency)} / {formatAmount(budgetCap, currency)}
            </b>
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          {accounts.map((a) => (
            <span key={a.key} className="inline-flex items-center gap-1">
              {a.key === "safe" ? (
                <PiggyBank className="h-3.5 w-3.5" />
              ) : (
                <Wallet className="h-3.5 w-3.5" />
              )}
              {ACCOUNT_LABEL[a.key]}{" "}
              <b
                className={cn(
                  "tabular-nums text-foreground",
                  a.balance < 0 && "text-destructive"
                )}
              >
                {formatAmount(a.balance, currency)}
              </b>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            New rows →
            <Select
              value={newAccount}
              onValueChange={(v) => setNewAccount(v as AccountKey)}
            >
              <SelectTrigger className="h-7 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACCOUNT_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </span>
      </Card>

      {loading ? (
        <SkeletonCard lines={8} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  Earned
                </th>
                <th className="px-3 py-2 font-semibold">For…</th>
                <th className="px-3 py-2 text-right font-semibold text-destructive">
                  Spent
                </th>
                <th className="px-3 py-2 font-semibold">For…</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dateKey = `${mKey}-${String(day).padStart(2, "0")}`;
                const bucket = byDay.get(dateKey) ?? { income: [], expense: [] };
                const weekday =
                  WEEKDAYS_SHORT[new Date(year, month, day).getDay()];
                const isToday = dateKey === todayKey;
                const isWeekend = weekday === "Sat" || weekday === "Sun";
                return (
                  <tr
                    key={dateKey}
                    className={cn(
                      "border-b last:border-0",
                      isWeekend && "bg-muted/30",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-1">
                      <span className="tabular-nums font-medium">
                        {day} {MONTHS_SHORT[month]}
                      </span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {weekday}
                      </span>
                    </td>
                    <AmountCell
                      entries={bucket.income}
                      tone="income"
                      onCommit={(num) =>
                        commitAmount(dateKey, "income", bucket.income, num)
                      }
                    />
                    <NoteCell
                      entries={bucket.income}
                      onCommit={(text) => commitNote(bucket.income, text)}
                    />
                    <AmountCell
                      entries={bucket.expense}
                      tone="expense"
                      onCommit={(num) =>
                        commitAmount(dateKey, "expense", bucket.expense, num)
                      }
                    />
                    <NoteCell
                      entries={bucket.expense}
                      onCommit={(text) => commitNote(bucket.expense, text)}
                    />
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatAmount(earned, currency)}
                </td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums text-destructive">
                  {formatAmount(spent, currency)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  Net{" "}
                  <span
                    className={cn(
                      "tabular-nums",
                      net >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    )}
                  >
                    {formatAmount(net, currency)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {user && (
        <BudgetFormDialog
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          userId={user.uid}
          budget={budget}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable cells
// ---------------------------------------------------------------------------

/** Editable amount cell. Empty = no entry; typing a number creates/updates it. */
function AmountCell({
  entries,
  tone,
  onCommit,
}: {
  entries: Expense[];
  tone: "income" | "expense";
  onCommit: (num: number | null) => void;
}) {
  const multiple = entries.length > 1;
  const value = multiple
    ? entries.reduce((s, e) => s + e.amount, 0)
    : entries[0]?.amount ?? null;

  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(value != null ? String(value) : "");
  }, [value]);

  function commit() {
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
  }

  return (
    <td className="px-1 py-0.5 text-right">
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={draft}
        disabled={multiple}
        title={multiple ? "Multiple entries this day — edit in export/CSV" : undefined}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            dirty.current = false;
            setDraft(value != null ? String(value) : "");
            e.currentTarget.blur();
          }
        }}
        placeholder="—"
        className={cn(
          "w-24 rounded bg-transparent px-2 py-1.5 text-right text-sm tabular-nums outline-none transition-colors placeholder:text-muted-foreground/40 focus:bg-accent focus:ring-1 focus:ring-primary disabled:cursor-not-allowed",
          value != null &&
            (tone === "income"
              ? "font-medium text-emerald-600 dark:text-emerald-400"
              : "font-medium text-destructive")
        )}
      />
    </td>
  );
}

/** Editable description cell — enabled only once the day/kind has an amount. */
function NoteCell({
  entries,
  onCommit,
}: {
  entries: Expense[];
  onCommit: (text: string) => void;
}) {
  const multiple = entries.length > 1;
  const value = multiple
    ? `${entries.length} entries`
    : entries[0]?.note ?? "";
  const disabled = entries.length === 0 || multiple;

  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  return (
    <td className="px-1 py-0.5">
      <input
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
        }}
        onBlur={() => {
          dirty.current = false;
          onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            dirty.current = false;
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
        placeholder={disabled && entries.length === 0 ? "" : "add note"}
        className="w-full min-w-[120px] rounded bg-transparent px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/40 focus:bg-accent focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
      />
    </td>
  );
}
