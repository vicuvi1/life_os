"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
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
  spendByCategory,
  categoryColor,
  categoryLabel,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABEL,
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
const DEFAULT_CATEGORY: Record<EntryKind, string> = {
  income: "salary",
  expense: "food",
};

type AccountFilter = "all" | AccountKey;

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

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
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [extraRows, setExtraRows] = useState<Record<string, number>>({});

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
  const inFilter = useCallback(
    (e: Expense) => filter === "all" || e.account === filter,
    [filter]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((e) => inMonth(e.date, mKey) && inFilter(e)),
    [expenses, mKey, inFilter]
  );

  const earned = useMemo(() => totalEarned(monthExpenses), [monthExpenses]);
  const spent = useMemo(() => totalSpent(monthExpenses), [monthExpenses]);
  const net = useMemo(() => netTotal(monthExpenses), [monthExpenses]);
  const savingsRate = earned > 0 ? (net / earned) * 100 : 0;

  // Previous month (for the "vs last month" comparisons).
  const prev = useMemo(() => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const pe = expenses.filter((e) => inMonth(e.date, monthKey(py, pm)) && inFilter(e));
    const inc = totalEarned(pe);
    const exp = totalSpent(pe);
    const n = netTotal(pe);
    return { inc, exp, net: n, rate: inc > 0 ? (n / inc) * 100 : 0 };
  }, [expenses, month, year, inFilter]);

  const byDay = useMemo(() => {
    const m = new Map<string, { income: Expense[]; expense: Expense[] }>();
    for (const e of monthExpenses) {
      const b = m.get(e.date) ?? { income: [], expense: [] };
      (e.kind === "income" ? b.income : b.expense).push(e);
      m.set(e.date, b);
    }
    for (const b of m.values()) {
      b.income.sort((a, c) => a.createdAt - c.createdAt);
      b.expense.sort((a, c) => a.createdAt - c.createdAt);
    }
    return m;
  }, [monthExpenses]);

  const openingTotal = useMemo(
    () => ACCOUNTS.reduce((s, a) => s + (budget?.openingBalances?.[a] ?? 0), 0),
    [budget]
  );
  const accounts = useMemo(
    () =>
      ACCOUNTS.map((a) => ({
        key: a,
        balance: accountBalance(expenses, a, budget?.openingBalances?.[a] ?? 0),
      })),
    [expenses, budget]
  );
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);

  const dim = daysInMonth(year, month);
  const days = useMemo(
    () => Array.from({ length: dim }, (_, i) => i + 1),
    [dim]
  );
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Balance carried before this month → start / end balance + per-day balances.
  const { startBalance, dayBalances } = useMemo(() => {
    const firstOfMonth = `${mKey}-01`;
    let base = openingTotal;
    for (const e of expenses) {
      if (e.date < firstOfMonth && inFilter(e)) {
        base += e.kind === "income" ? e.amount : -e.amount;
      }
    }
    const start = Math.round(base * 100) / 100;
    const map: Record<string, number> = {};
    let running = start;
    for (let d = 1; d <= dim; d++) {
      const key = `${mKey}-${String(d).padStart(2, "0")}`;
      const b = byDay.get(key);
      if (b) {
        for (const e of b.income) running += e.amount;
        for (const e of b.expense) running -= e.amount;
      }
      map[key] = Math.round(running * 100) / 100;
    }
    return { startBalance: start, dayBalances: map };
  }, [expenses, byDay, openingTotal, mKey, dim, inFilter]);
  const endBalance = Math.round((startBalance + net) * 100) / 100;

  // 12-month summary for the selected year.
  const monthly = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => {
        const me = expenses.filter(
          (e) => inMonth(e.date, monthKey(year, m)) && inFilter(e)
        );
        return {
          m,
          income: totalEarned(me),
          expense: totalSpent(me),
          net: netTotal(me),
        };
      }),
    [expenses, year, inFilter]
  );
  const yearTotal = monthly.reduce(
    (a, x) => ({
      income: a.income + x.income,
      expense: a.expense + x.expense,
      net: a.net + x.net,
    }),
    { income: 0, expense: 0, net: 0 }
  );

  const byCategory = useMemo(() => spendByCategory(monthExpenses), [monthExpenses]);

  // Quick summary.
  const quick = useMemo(() => {
    const perDay = new Map<string, { inc: number; exp: number }>();
    for (const e of monthExpenses) {
      const p = perDay.get(e.date) ?? { inc: 0, exp: 0 };
      if (e.kind === "income") p.inc += e.amount;
      else p.exp += e.amount;
      perDay.set(e.date, p);
    }
    let hiInc: { date: string; amt: number } | null = null;
    let hiExp: { date: string; amt: number } | null = null;
    for (const [date, p] of perDay) {
      if (p.inc > 0 && (!hiInc || p.inc > hiInc.amt)) hiInc = { date, amt: p.inc };
      if (p.exp > 0 && (!hiExp || p.exp > hiExp.amt)) hiExp = { date, amt: p.exp };
    }
    const activeDays = isCurrentMonth ? now.getDate() : dim;
    return {
      hiInc,
      hiExp,
      avgExpense: activeDays > 0 ? spent / activeDays : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthExpenses, spent, dim, isCurrentMonth]);

  const savingsTarget = budget?.savingsGoal ?? null;
  const savingsProgress =
    savingsTarget && savingsTarget > 0
      ? Math.max(0, (netWorth / savingsTarget) * 100)
      : null;

  // --- Inline mutations (optimistic; resync on error) ------------------------
  async function commitAmount(
    dateKey: string,
    kind: EntryKind,
    entry: Expense | undefined,
    num: number | null
  ) {
    if (!user) return;
    try {
      if (num == null) {
        if (entry) {
          setExpenses((prev) => prev.filter((x) => x.id !== entry.id));
          await deleteExpense(entry.id);
        }
        return;
      }
      if (entry) {
        setExpenses((prev) =>
          prev.map((x) => (x.id === entry.id ? { ...x, amount: num } : x))
        );
        await updateExpense(entry.id, { amount: num });
      } else {
        const draft = {
          kind,
          amount: num,
          account: newAccount,
          category: DEFAULT_CATEGORY[kind],
          note: null,
          date: dateKey,
        };
        const id = await createExpense(user.uid, draft);
        setExpenses((prev) => [
          ...prev,
          { id, userId: user.uid, createdAt: Date.now(), ...draft },
        ]);
        setExtraRows((prev) =>
          prev[dateKey] ? { ...prev, [dateKey]: prev[dateKey] - 1 } : prev
        );
      }
    } catch {
      await load({ quiet: true });
    }
  }

  async function commitNote(entry: Expense, text: string) {
    const note = text.trim() || null;
    if (note === (entry.note ?? null)) return;
    setExpenses((prev) =>
      prev.map((x) => (x.id === entry.id ? { ...x, note } : x))
    );
    try {
      await updateExpense(entry.id, { note });
    } catch {
      await load({ quiet: true });
    }
  }

  async function commitCategory(entry: Expense, category: string) {
    if (category === entry.category) return;
    setExpenses((prev) =>
      prev.map((x) => (x.id === entry.id ? { ...x, category } : x))
    );
    try {
      await updateExpense(entry.id, { category });
    } catch {
      await load({ quiet: true });
    }
  }

  async function removeEntry(entry: Expense) {
    setExpenses((prev) => prev.filter((x) => x.id !== entry.id));
    try {
      await deleteExpense(entry.id);
    } catch {
      await load({ quiet: true });
    }
  }

  function addLine(dateKey: string) {
    setExtraRows((prev) => ({ ...prev, [dateKey]: (prev[dateKey] ?? 0) + 1 }));
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

  // Flattened transaction rows: every day shown; one row per entry (+ an empty
  // row to add to a day), balance on the day's last row.
  const rows = useMemo(() => {
    const out: {
      dateKey: string;
      day: number;
      weekday: string;
      firstOfDay: boolean;
      lastOfDay: boolean;
      entry?: Expense;
      kind: EntryKind | null;
    }[] = [];
    for (const day of days) {
      const dateKey = `${mKey}-${String(day).padStart(2, "0")}`;
      const weekday = WEEKDAYS_SHORT[new Date(year, month, day).getDay()];
      const b = byDay.get(dateKey) ?? { income: [], expense: [] };
      const items: { entry: Expense; kind: EntryKind }[] = [
        ...b.income.map((e) => ({ entry: e, kind: "income" as EntryKind })),
        ...b.expense.map((e) => ({ entry: e, kind: "expense" as EntryKind })),
      ].sort((a, c) => a.entry.createdAt - c.entry.createdAt);
      const empties = (items.length === 0 ? 1 : 0) + (extraRows[dateKey] ?? 0);
      const total = items.length + empties;
      for (let i = 0; i < total; i++) {
        const rec = items[i];
        out.push({
          dateKey,
          day,
          weekday,
          firstOfDay: i === 0,
          lastOfDay: i === total - 1,
          entry: rec?.entry,
          kind: rec?.kind ?? null,
        });
      }
    }
    return out;
  }, [days, byDay, extraRows, mKey, year, month]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Finance</h1>
          <p className="text-muted-foreground">
            Track your income, expenses and savings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as AccountFilter)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {ACCOUNTS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACCOUNT_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-md border px-2 text-sm text-muted-foreground">
            <PiggyBank className="h-3.5 w-3.5" /> New →
            <Select value={newAccount} onValueChange={(v) => setNewAccount(v as AccountKey)}>
              <SelectTrigger className="h-8 w-[92px] border-0 px-1 shadow-none">
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
          </div>
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
        <p className="text-lg font-semibold">{monthLabel(year, month)}</p>
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

      {loading ? (
        <SkeletonCard lines={12} />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Total income" value={formatAmount(earned, currency)} tone="up"
              delta={{ pct: pctChange(earned, prev.inc), good: earned >= prev.inc }} />
            <Kpi label="Total expenses" value={formatAmount(spent, currency)} tone="down"
              delta={{ pct: pctChange(spent, prev.exp), good: spent <= prev.exp }} />
            <Kpi label="Net amount" value={formatAmount(net, currency)} tone={net >= 0 ? "up" : "down"}
              delta={{ pct: pctChange(net, prev.net), good: net >= prev.net }} />
            <Kpi label="Savings rate" value={`${savingsRate.toFixed(1)}%`} tone="neutral"
              delta={{ pct: savingsRate - prev.rate, good: savingsRate >= prev.rate, unit: "pp" }} />
            <Kpi label="Start balance" value={formatAmount(startBalance, currency)} tone="neutral" />
            <Kpi label="End balance" value={formatAmount(endBalance, currency)} tone={endBalance >= 0 ? "up" : "down"} />
          </div>

          {/* Dashboard grid */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Transactions */}
            <div className="xl:col-span-6">
              <Panel title="Transactions" bodyClassName="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-[70px]" />
                      <col className="w-[46px]" />
                      <col className="w-[88px]" />
                      <col className="w-[128px]" />
                      <col />
                      <col className="w-[92px]" />
                      <col className="w-[92px]" />
                      <col className="w-[100px]" />
                      <col className="w-[32px]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2">Date</th>
                        <th className="px-1 py-2">Day</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Category</th>
                        <th className="px-2 py-2">Description</th>
                        <th className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400">Income</th>
                        <th className="px-2 py-2 text-right text-rose-600 dark:text-rose-400">Expense</th>
                        <th className="px-2 py-2 text-right">Balance</th>
                        <th className="px-1 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => {
                        const isToday = r.dateKey === todayKey;
                        const isWeekend = r.weekday === "Sat" || r.weekday === "Sun";
                        return (
                          <tr
                            key={`${r.dateKey}-${idx}`}
                            className={cn(
                              "group border-b last:border-0",
                              isWeekend && "bg-muted/20",
                              isToday && "bg-primary/5",
                              "hover:bg-accent/40"
                            )}
                          >
                            <td className="px-2 py-1 align-middle">
                              {r.firstOfDay && (
                                <span className="tabular-nums font-medium">
                                  {r.day} {MONTHS_SHORT[month]}
                                </span>
                              )}
                            </td>
                            <td className="px-1 py-1 align-middle">
                              {r.firstOfDay && (
                                <span className="text-xs text-muted-foreground">{r.weekday}</span>
                              )}
                            </td>
                            <td className="px-2 py-1 align-middle">
                              {r.entry ? (
                                <span
                                  className={cn(
                                    "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                    r.kind === "income"
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                  )}
                                >
                                  {r.kind}
                                </span>
                              ) : (
                                r.firstOfDay && <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            <td className="px-1 py-1 align-middle">
                              {r.entry && (
                                <CategorySelect
                                  entry={r.entry}
                                  kind={r.kind as EntryKind}
                                  onChange={(c) => commitCategory(r.entry!, c)}
                                />
                              )}
                            </td>
                            <td className="px-1 py-1 align-middle">
                              {r.entry && (
                                <NoteInput entry={r.entry} onCommit={(t) => commitNote(r.entry!, t)} />
                              )}
                            </td>
                            {/* Income */}
                            <td className="px-1 py-1 text-right align-middle">
                              {r.kind === "income" || r.kind === null ? (
                                <AmountInput
                                  value={r.entry?.amount ?? null}
                                  tone="income"
                                  onCommit={(num) =>
                                    commitAmount(r.dateKey, "income", r.entry, num)
                                  }
                                />
                              ) : (
                                <span className="pr-2 text-muted-foreground/30">–</span>
                              )}
                            </td>
                            {/* Expense */}
                            <td className="px-1 py-1 text-right align-middle">
                              {r.kind === "expense" || r.kind === null ? (
                                <AmountInput
                                  value={r.entry?.amount ?? null}
                                  tone="expense"
                                  onCommit={(num) =>
                                    commitAmount(r.dateKey, "expense", r.entry, num)
                                  }
                                />
                              ) : (
                                <span className="pr-2 text-muted-foreground/30">–</span>
                              )}
                            </td>
                            {/* Balance */}
                            <td
                              className={cn(
                                "px-2 py-1 text-right align-middle tabular-nums",
                                r.lastOfDay
                                  ? dayBalances[r.dateKey] < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                  : "text-transparent"
                              )}
                            >
                              {r.lastOfDay ? formatAmount(dayBalances[r.dateKey] ?? 0, currency) : ""}
                            </td>
                            {/* Actions */}
                            <td className="px-1 py-1 text-center align-middle">
                              {r.entry ? (
                                <button
                                  onClick={() => removeEntry(r.entry!)}
                                  aria-label="Delete entry"
                                  className="rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                r.firstOfDay && (
                                  <button
                                    onClick={() => addLine(r.dateKey)}
                                    aria-label="Add entry"
                                    className="rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/40 font-semibold">
                        <td className="px-2 py-2.5" colSpan={5}>Total</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatAmount(earned, currency)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                          {formatAmount(spent, currency)}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          {formatAmount(endBalance, currency)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Panel>
            </div>

            {/* Middle column: overview + charts + quick summary */}
            <div className="space-y-4 xl:col-span-3">
              <Panel title="Overview">
                <dl className="space-y-2 text-sm">
                  <Row label="Total Income" value={formatAmount(earned, currency)} valueClass="text-emerald-600 dark:text-emerald-400" />
                  <Row label="Total Expenses" value={formatAmount(spent, currency)} valueClass="text-rose-600 dark:text-rose-400" />
                  <Row label="Net Amount" value={formatAmount(net, currency)} valueClass={net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"} />
                  <Row label="Savings Rate" value={`${savingsRate.toFixed(1)}%`} />
                </dl>
              </Panel>

              <Panel title="Expenses by category">
                <Donut data={byCategory} currency={currency} />
              </Panel>

              <Panel title="Income vs expenses">
                <IncomeExpenseBars income={earned} expense={spent} currency={currency} />
              </Panel>

              <Panel title="Quick summary">
                <dl className="space-y-2 text-sm">
                  <Row
                    label="Highest income day"
                    value={quick.hiInc ? formatDate(quick.hiInc.date) : "—"}
                  />
                  <Row
                    label="Highest expense day"
                    value={quick.hiExp ? formatDate(quick.hiExp.date) : "—"}
                  />
                  <Row label="Average daily expense" value={formatAmount(quick.avgExpense, currency)} />
                  <Row label="Current balance" value={formatAmount(endBalance, currency)} />
                </dl>
              </Panel>
            </div>

            {/* Right column: monthly summary + savings goal + notes */}
            <div className="space-y-4 xl:col-span-3">
              <Panel title="Monthly summary" bodyClassName="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Month</th>
                        <th className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400">Income</th>
                        <th className="px-2 py-2 text-right text-rose-600 dark:text-rose-400">Expenses</th>
                        <th className="px-3 py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((row) => (
                        <tr
                          key={row.m}
                          className={cn(
                            "border-b last:border-0",
                            row.m === month && "bg-primary/5 font-medium"
                          )}
                        >
                          <td className="px-3 py-1.5">{MONTHS_SHORT[row.m]} {year}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatAmount(row.income, currency)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                            {formatAmount(row.expense, currency)}
                          </td>
                          <td className={cn("px-3 py-1.5 text-right tabular-nums", row.net < 0 && "text-destructive")}>
                            {formatAmount(row.net, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/40 font-semibold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatAmount(yearTotal.income, currency)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                          {formatAmount(yearTotal.expense, currency)}
                        </td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", yearTotal.net < 0 && "text-destructive")}>
                          {formatAmount(yearTotal.net, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Panel>

              <Panel title="Savings goal">
                {savingsTarget && savingsTarget > 0 ? (
                  <div className="space-y-3">
                    <Row label="Target amount" value={formatAmount(savingsTarget, currency)} />
                    <Row label="Current savings" value={formatAmount(netWorth, currency)} />
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{(savingsProgress ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(100, savingsProgress ?? 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Set a savings target to track progress against your net worth.</p>
                    <Button variant="outline" size="sm" onClick={() => setBudgetOpen(true)}>
                      Set a goal
                    </Button>
                  </div>
                )}
              </Panel>

              <Panel title="Notes">
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>• Enter income and expenses every day.</li>
                  <li>• Review your spending weekly.</li>
                  <li>• Keep an eye on your savings rate.</li>
                  <li>• Save more, stress less!</li>
                </ul>
              </Panel>
            </div>
          </div>
        </>
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

function formatDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Presentational
// ---------------------------------------------------------------------------
function Panel({
  title,
  children,
  bodyClassName,
}: {
  title: string;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  delta,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
  delta?: { pct: number; good: boolean; unit?: string };
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "up" && "text-emerald-600 dark:text-emerald-400",
          tone === "down" && "text-rose-600 dark:text-rose-400"
        )}
      >
        {value}
      </p>
      {delta && (
        <p className="mt-1 flex items-center gap-1 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              delta.good
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {delta.pct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta.pct).toFixed(delta.unit === "pp" ? 1 : 0)}
            {delta.unit === "pp" ? "pp" : "%"}
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </p>
      )}
    </Card>
  );
}

function Donut({
  data,
  currency,
}: {
  data: { category: string; amount: number }[];
  currency: ReturnType<typeof resolveCurrency>;
}) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total <= 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No expenses yet
      </div>
    );
  }
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const top = data.slice(0, 6);
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0">
        {data.map((d) => {
          const len = (d.amount / total) * c;
          const el = (
            <circle
              key={d.category}
              cx={70}
              cy={70}
              r={r}
              fill="none"
              stroke={categoryColor(d.category)}
              strokeWidth={18}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += len;
          return el;
        })}
        <text
          x={70}
          y={74}
          textAnchor="middle"
          className="fill-foreground text-[13px] font-semibold"
        >
          {formatAmount(total, currency)}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {top.map((d) => (
          <li key={d.category} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor(d.category) }}
              />
              <span className="truncate">{categoryLabel(d.category)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Math.round((d.amount / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IncomeExpenseBars({
  income,
  expense,
  currency,
}: {
  income: number;
  expense: number;
  currency: ReturnType<typeof resolveCurrency>;
}) {
  const max = Math.max(income, expense, 1);
  return (
    <div className="flex h-44 items-end justify-around gap-6 pt-4">
      {[
        { label: "Income", value: income, cls: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
        { label: "Expenses", value: expense, cls: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
      ].map((b) => (
        <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className={cn("text-xs font-semibold tabular-nums", b.text)}>
            {formatAmount(b.value, currency)}
          </span>
          <div
            className={cn("w-full max-w-[72px] rounded-t transition-all", b.cls)}
            style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }}
          />
          <span className="text-xs text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable inputs
// ---------------------------------------------------------------------------
function AmountInput({
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
    <input
      type="number"
      min={0}
      step="0.01"
      inputMode="decimal"
      value={draft}
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
        "w-full rounded bg-transparent px-2 py-1 text-right tabular-nums outline-none transition-colors placeholder:text-muted-foreground/30 hover:bg-background/70 focus:bg-background focus:ring-1 focus:ring-primary",
        value != null &&
          (tone === "income"
            ? "font-semibold text-emerald-600 dark:text-emerald-400"
            : "font-semibold text-rose-600 dark:text-rose-400")
      )}
    />
  );
}

function NoteInput({
  entry,
  onCommit,
}: {
  entry: Expense;
  onCommit: (text: string) => void;
}) {
  const value = entry.note ?? "";
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      value={draft}
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
      placeholder="add note"
      className="w-full rounded bg-transparent px-2 py-1 outline-none transition-colors placeholder:text-muted-foreground/30 hover:bg-background/70 focus:bg-background focus:ring-1 focus:ring-primary"
    />
  );
}

function CategorySelect({
  entry,
  kind,
  onChange,
}: {
  entry: Expense;
  kind: EntryKind;
  onChange: (category: string) => void;
}) {
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const label = (c: string) =>
    kind === "income"
      ? INCOME_CATEGORY_LABEL[c as keyof typeof INCOME_CATEGORY_LABEL] ?? c
      : EXPENSE_CATEGORY_LABEL[c as keyof typeof EXPENSE_CATEGORY_LABEL] ?? c;

  return (
    <Select value={entry.category} onValueChange={onChange}>
      <SelectTrigger className="h-8 border-transparent bg-transparent px-2 text-sm hover:bg-background/70">
        <span className="flex items-center gap-1.5 truncate">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: categoryColor(entry.category) }}
          />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {cats.map((c) => (
          <SelectItem key={c} value={c}>
            {label(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
