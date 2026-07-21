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
  Wallet,
  PiggyBank,
  Landmark,
  Target,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Utensils,
  Car,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Briefcase,
  Gift,
  Undo2,
  Tag,
  ArrowRightLeft,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getExpenses,
  getBudget,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/firebase/db";
import { toDateKey, resolveFirstName } from "@/lib/greeting";
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
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { BudgetFormDialog } from "@/components/expenses/budget-form-dialog";
import { cn } from "@/lib/utils";
import type { AccountKey, Budget, EntryKind, Expense } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_CATEGORY: Record<EntryKind, string> = { income: "salary", expense: "food" };

const CATEGORY_ICON: Record<string, LucideIcon> = {
  food: Utensils,
  transport: Car,
  fitness: Dumbbell,
  entertainment: Gamepad2,
  education: GraduationCap,
  health: HeartPulse,
  salary: Briefcase,
  allowance: Wallet,
  gift: Gift,
  sale: Tag,
  refund: Undo2,
  investment: TrendingUp,
  other: Tag,
};
const iconFor = (cat: string): LucideIcon => CATEGORY_ICON[cat] ?? Tag;

type AccountFilter = "all" | AccountKey;

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
}
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export default function FinancePage() {
  const { user, displayName } = useAuth();
  const now = useMemo(() => new Date(), []);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<AccountKey>("wallet");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [extraRows, setExtraRows] = useState<Record<string, number>>({});
  const [form, setForm] = useState<{ open: boolean; expense: Expense | null; kind: EntryKind }>({
    open: false,
    expense: null,
    kind: "expense",
  });

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!user) return;
      if (!opts?.quiet) setLoading(true);
      try {
        const [ex, bg] = await Promise.all([getExpenses(user.uid), getBudget(user.uid)]);
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
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
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
  const net = earned - spent;
  const savingsRate = earned > 0 ? (net / earned) * 100 : 0;

  const spentToday = useMemo(
    () => totalSpent(monthExpenses.filter((e) => e.date === todayKey)),
    [monthExpenses, todayKey]
  );
  const netToday = useMemo(
    () => netTotal(monthExpenses.filter((e) => e.date === todayKey)),
    [monthExpenses, todayKey]
  );

  const prev = useMemo(() => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const pe = expenses.filter((e) => inMonth(e.date, monthKey(py, pm)) && inFilter(e));
    return { inc: totalEarned(pe), exp: totalSpent(pe), net: netTotal(pe) };
  }, [expenses, month, year, inFilter]);

  const byDay = useMemo(() => {
    const m = new Map<string, { income: Expense[]; expense: Expense[]; net: number }>();
    for (const e of monthExpenses) {
      const b = m.get(e.date) ?? { income: [], expense: [], net: 0 };
      (e.kind === "income" ? b.income : b.expense).push(e);
      b.net += e.kind === "income" ? e.amount : -e.amount;
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
  const walletBalance = accountBalance(expenses, "wallet", budget?.openingBalances?.wallet ?? 0);
  const safeBalance = accountBalance(expenses, "safe", budget?.openingBalances?.safe ?? 0);
  const netWorth = walletBalance + safeBalance;

  const dim = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim]);

  const { startBalance, dayBalances } = useMemo(() => {
    const firstOfMonth = `${mKey}-01`;
    let base = openingTotal;
    for (const e of expenses) {
      if (e.date < firstOfMonth && inFilter(e)) base += e.kind === "income" ? e.amount : -e.amount;
    }
    const start = Math.round(base * 100) / 100;
    const map: Record<string, number> = {};
    let running = start;
    for (let d = 1; d <= dim; d++) {
      const key = `${mKey}-${String(d).padStart(2, "0")}`;
      const b = byDay.get(key);
      if (b) running += b.net;
      map[key] = Math.round(running * 100) / 100;
    }
    return { startBalance: start, dayBalances: map };
  }, [expenses, byDay, openingTotal, mKey, dim, inFilter]);
  const endBalance = Math.round((startBalance + net) * 100) / 100;

  // Sparkline of net worth across days up to today (or the whole month).
  const sparkData = useMemo(() => {
    const upto = isCurrentMonth ? now.getDate() : dim;
    return days.slice(0, upto).map((d) => dayBalances[`${mKey}-${String(d).padStart(2, "0")}`] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, dayBalances, mKey, dim, isCurrentMonth]);

  const monthly = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => {
        const me = expenses.filter((e) => inMonth(e.date, monthKey(year, m)) && inFilter(e));
        return { m, income: totalEarned(me), expense: totalSpent(me) };
      }),
    [expenses, year, inFilter]
  );

  const byCategory = useMemo(() => spendByCategory(monthExpenses), [monthExpenses]);

  const recent = useMemo(
    () =>
      [...expenses]
        .filter(inFilter)
        .sort((a, b) => b.createdAt - a.createdAt || (a.date < b.date ? 1 : -1))
        .slice(0, 6),
    [expenses, inFilter]
  );

  const savingsTarget = budget?.savingsGoal ?? null;
  const savingsProgress =
    savingsTarget && savingsTarget > 0 ? Math.max(0, (netWorth / savingsTarget) * 100) : null;
  const daysElapsed = isCurrentMonth ? now.getDate() : dim;
  const avgDailyNet = daysElapsed > 0 ? net / daysElapsed : 0;
  const daysToGoal =
    savingsTarget && avgDailyNet > 0 && netWorth < savingsTarget
      ? Math.ceil((savingsTarget - netWorth) / avgDailyNet)
      : null;

  // Insights — "what to do next".
  const insights = useMemo(() => {
    const out: { icon: LucideIcon; tone: "good" | "warn" | "info"; text: string }[] = [];
    if (prev.exp > 0) {
      const diff = pctChange(spent, prev.exp);
      out.push(
        diff <= 0
          ? { icon: TrendingDown, tone: "good", text: `You've spent ${Math.abs(diff).toFixed(0)}% less than last month. Nice.` }
          : { icon: TrendingUp, tone: "warn", text: `You're spending ${diff.toFixed(0)}% more than last month.` }
      );
    }
    if (byCategory.length > 0 && spent > 0) {
      const top = byCategory[0];
      out.push({
        icon: iconFor(top.category),
        tone: "info",
        text: `Most of your spending is on ${categoryLabel(top.category)} (${Math.round((top.amount / spent) * 100)}%).`,
      });
    }
    if (savingsTarget) {
      if (savingsProgress != null && savingsProgress >= 100)
        out.push({ icon: Target, tone: "good", text: `You've reached your ${formatAmount(savingsTarget, currency)} savings goal! 🎉` });
      else if (daysToGoal != null)
        out.push({ icon: Target, tone: "good", text: `At your current pace you'll hit your goal in ~${daysToGoal} days.` });
      else
        out.push({ icon: Target, tone: "warn", text: `You're not saving this month — add income or trim spending to reach your goal.` });
    }
    if (isCurrentMonth) {
      out.push(
        netToday >= 0
          ? { icon: Sparkles, tone: "good", text: `Today you're net ${formatAmount(netToday, currency)}.` }
          : { icon: Sparkles, tone: "info", text: `You've spent ${formatAmount(spentToday, currency)} today.` }
      );
    }
    return out.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev, spent, byCategory, savingsTarget, savingsProgress, daysToGoal, netToday, spentToday, isCurrentMonth, currency]);

  const budgetStatus = useMemo(() => {
    if (budget?.monthlyTotal == null) return null;
    const spentSoFar = spent;
    const remaining = Math.round((budget.monthlyTotal - spentSoFar) * 100) / 100;
    const pctUsed = budget.monthlyTotal > 0 ? Math.min(100, (spentSoFar / budget.monthlyTotal) * 100) : null;
    const daysElapsed = isCurrentMonth ? now.getDate() : dim;
    const projectedSpend = daysElapsed > 0 ? Math.round((spentSoFar / daysElapsed) * dim * 100) / 100 : 0;
    return {
      spent: spentSoFar,
      budget: budget.monthlyTotal,
      remaining,
      pctUsed,
      projectedSpend,
      daysElapsed,
      daysRemaining: Math.max(0, dim - daysElapsed),
    };
  }, [budget?.monthlyTotal, spent, isCurrentMonth, now, dim]);

  const financialScore = useMemo(() => {
    let score = 45;
    if (net >= 0) score += 15;
    if (savingsRate >= 10) score += 10;
    if (savingsRate >= 25) score += 10;
    if (budgetStatus?.pctUsed != null && budgetStatus.pctUsed < 75) score += 10;
    if (savingsTarget && savingsProgress != null) score += Math.min(20, Math.round(savingsProgress / 5));
    return Math.min(100, Math.max(0, score));
  }, [net, savingsRate, budgetStatus?.pctUsed, savingsTarget, savingsProgress]);

  const financialScoreLabel = useMemo(() => {
    if (financialScore >= 85) return { label: "Excellent", tone: "good" as const };
    if (financialScore >= 65) return { label: "Strong", tone: "info" as const };
    if (financialScore >= 45) return { label: "Solid", tone: "warn" as const };
    return { label: "Needs attention", tone: "destructive" as const };
  }, [financialScore]);

  // --- Mutations -------------------------------------------------------------
  async function commitAmount(dateKey: string, kind: EntryKind, entry: Expense | undefined, num: number | null) {
    if (!user) return;
    try {
      if (num == null) {
        if (entry) {
          setExpenses((p) => p.filter((x) => x.id !== entry.id));
          await deleteExpense(entry.id);
        }
        return;
      }
      if (entry) {
        setExpenses((p) => p.map((x) => (x.id === entry.id ? { ...x, amount: num } : x)));
        await updateExpense(entry.id, { amount: num });
      } else {
        const draft = { kind, amount: num, account: newAccount, category: DEFAULT_CATEGORY[kind], note: null, date: dateKey };
        const id = await createExpense(user.uid, draft);
        setExpenses((p) => [...p, { id, userId: user.uid, createdAt: Date.now(), ...draft }]);
        setExtraRows((p) => (p[dateKey] ? { ...p, [dateKey]: p[dateKey] - 1 } : p));
      }
    } catch {
      await load({ quiet: true });
    }
  }
  async function commitNote(entry: Expense, text: string) {
    const note = text.trim() || null;
    if (note === (entry.note ?? null)) return;
    setExpenses((p) => p.map((x) => (x.id === entry.id ? { ...x, note } : x)));
    try {
      await updateExpense(entry.id, { note });
    } catch {
      await load({ quiet: true });
    }
  }
  async function commitCategory(entry: Expense, category: string) {
    if (category === entry.category) return;
    setExpenses((p) => p.map((x) => (x.id === entry.id ? { ...x, category } : x)));
    try {
      await updateExpense(entry.id, { category });
    } catch {
      await load({ quiet: true });
    }
  }
  async function removeEntry(entry: Expense) {
    setExpenses((p) => p.filter((x) => x.id !== entry.id));
    try {
      await deleteExpense(entry.id);
    } catch {
      await load({ quiet: true });
    }
  }
  function addLine(dateKey: string) {
    setExtraRows((p) => ({ ...p, [dateKey]: (p[dateKey] ?? 0) + 1 }));
  }
  function exportCsv(scope: "month" | "all") {
    const data = scope === "month" ? monthExpenses : expenses;
    if (data.length === 0) return;
    downloadCsv(scope === "month" ? `finance-${mKey}.csv` : "finance-all.csv", entriesToCsv(data));
  }
  function openAdd(kind: EntryKind) {
    setForm({ open: true, expense: null, kind });
  }
  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  }

  const rows = useMemo(() => {
    const out: {
      dateKey: string; day: number; weekday: string;
      firstOfDay: boolean; lastOfDay: boolean;
      entry?: Expense; kind: EntryKind | null;
    }[] = [];
    for (const day of days) {
      const dateKey = `${mKey}-${String(day).padStart(2, "0")}`;
      const weekday = WEEKDAYS_SHORT[new Date(year, month, day).getDay()];
      const b = byDay.get(dateKey) ?? { income: [], expense: [], net: 0 };
      const items: { entry: Expense; kind: EntryKind }[] = [
        ...b.income.map((e) => ({ entry: e, kind: "income" as EntryKind })),
        ...b.expense.map((e) => ({ entry: e, kind: "expense" as EntryKind })),
      ].sort((a, c) => a.entry.createdAt - c.entry.createdAt);
      const empties = (items.length === 0 ? 1 : 0) + (extraRows[dateKey] ?? 0);
      const total = items.length + empties;
      for (let i = 0; i < total; i++) {
        const rec = items[i];
        out.push({
          dateKey, day, weekday,
          firstOfDay: i === 0, lastOfDay: i === total - 1,
          entry: rec?.entry, kind: rec?.kind ?? null,
        });
      }
    }
    return out;
  }, [days, byDay, extraRows, mKey, year, month]);

  const firstName = resolveFirstName(displayName, user?.email ?? null);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            {greeting()}, {firstName}! <span className="align-middle">👋</span>
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s your financial overview for {monthLabel(year, month)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={prevMonth} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[96px] text-center text-sm font-medium">{monthLabel(year, month)}</span>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={nextMonth} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as AccountFilter)}>
            <SelectTrigger className="h-9 w-[132px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{ACCOUNT_LABEL[a]}</SelectItem>)}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Export"><Download className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCsv("month")}>This month (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv("all")}>All time (CSV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" aria-label="Settings" onClick={() => setBudgetOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button onClick={() => openAdd("expense")}>
            <Plus className="h-4 w-4" /> Add transaction
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonCard lines={12} />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={Landmark}
              iconClass="bg-primary/15 text-primary"
              label="Current money"
              value={formatAmount(netWorth, currency)}
              sub={
                <Delta pct={pctChange(netWorth, netWorth - net)} good={net >= 0} suffix="vs last month" />
              }
              spark={sparkData}
            />
            <StatCard
              icon={Wallet}
              iconClass="bg-sky-500/15 text-sky-500"
              label="Wallet (cash)"
              value={formatAmount(walletBalance, currency)}
              sub={<span className="text-xs text-muted-foreground">Available to spend</span>}
            />
            <StatCard
              icon={PiggyBank}
              iconClass="bg-emerald-500/15 text-emerald-500"
              label="Safe (savings)"
              value={formatAmount(safeBalance, currency)}
              sub={<span className="text-xs text-muted-foreground">Keep building 💪</span>}
            />
            <StatCard
              icon={BarChart3}
              iconClass="bg-violet-500/15 text-violet-500"
              label="Total net worth"
              value={formatAmount(netWorth, currency)}
              sub={<span className="text-xs text-muted-foreground">Includes wallet and savings</span>}
            />
            <StatCard
              icon={Target}
              iconClass="bg-violet-500/15 text-violet-500"
              label="Savings goal"
              value={savingsTarget ? formatAmount(savingsTarget, currency) : "—"}
              sub={
                savingsTarget ? (
                  <div className="mt-1 space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, savingsProgress ?? 0)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(savingsProgress ?? 0).toFixed(0)}% · {formatAmount(netWorth, currency)}
                    </span>
                  </div>
                ) : (
                  <button onClick={() => setBudgetOpen(true)} className="text-xs text-primary hover:underline">
                    Set a goal
                  </button>
                )
              }
            />
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {insights.map((ins, i) => (
                <Card key={i} className="flex items-start gap-3 p-4">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      ins.tone === "good" && "bg-emerald-500/15 text-emerald-500",
                      ins.tone === "warn" && "bg-amber-500/15 text-amber-500",
                      ins.tone === "info" && "bg-sky-500/15 text-sky-500"
                    )}
                  >
                    <ins.icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm leading-snug">{ins.text}</p>
                </Card>
              ))}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Panel title="Spending overview" action={<Button variant="ghost" size="sm">View full report</Button>}>
                  <Donut data={byCategory} currency={currency} total={spent} />
                </Panel>
                <Panel title="Income vs expenses" action={<Button variant="ghost" size="sm" onClick={() => exportCsv("month")}>Export</Button>}>
                  <IncomeExpenseBars income={earned} expense={spent} net={net} currency={currency} />
                </Panel>
                <Panel title="Calendar heatmap" action={<span className="text-xs text-muted-foreground">{days.length} days</span>}>
                  <Heatmap year={year} month={month} byDay={byDay} todayKey={todayKey} />
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Recent activity">
                    {recent.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
                    ) : (
                      <ul className="divide-y">
                        {recent.map((e) => {
                          const Icon = iconFor(e.category);
                          return (
                            <li key={e.id} className="flex items-center gap-3 py-2.5">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: `${categoryColor(e.category)}22`, color: categoryColor(e.category) }}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{e.note || categoryLabel(e.category)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDayLabel(e.date)} · {ACCOUNT_LABEL[e.account]}
                                </p>
                              </div>
                              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", e.kind === "income" ? "text-emerald-500" : "text-rose-500")}>
                                {e.kind === "income" ? "+" : "−"}{formatAmount(e.amount, currency)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Panel>

                  <Panel title="Monthly trend">
                    <TrendChart data={monthly} currency={currency} highlight={month} />
                  </Panel>
                </div>

                <Panel title="Quick add">
                  <div className="grid grid-cols-2 gap-3">
                    <QuickAdd icon={TrendingUp} label="Income" cls="hover:border-emerald-500/60 hover:bg-emerald-500/5" iconCls="bg-emerald-500/15 text-emerald-500" onClick={() => openAdd("income")} />
                    <QuickAdd icon={TrendingDown} label="Expense" cls="hover:border-rose-500/60 hover:bg-rose-500/5" iconCls="bg-rose-500/15 text-rose-500" onClick={() => openAdd("expense")} />
                    <QuickAdd icon={ArrowRightLeft} label="Transfer" cls="hover:border-sky-500/60 hover:bg-sky-500/5" iconCls="bg-sky-500/15 text-sky-500" onClick={() => openAdd("expense")} />
                    <QuickAdd icon={Settings2} label="Settings" cls="hover:border-primary/60 hover:bg-primary/5" iconCls="bg-primary/15 text-primary" onClick={() => setBudgetOpen(true)} />
                  </div>
                  <div className="mt-4 space-y-2 rounded-lg border p-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="font-semibold tabular-nums text-emerald-500">{formatAmount(earned, currency)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span className="font-semibold tabular-nums text-rose-500">{formatAmount(spent, currency)}</span></div>
                    <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Net</span><span className={cn("font-semibold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatAmount(net, currency)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Savings rate</span><span className="font-semibold tabular-nums">{savingsRate.toFixed(1)}%</span></div>
                  </div>
                </Panel>
              </div>

              <Panel title="Transactions" bodyClassName="p-0">
                <div className="max-h-[680px] overflow-y-auto">
                  <div className="overflow-x-auto min-w-full">
                    <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-[86px]" /><col className="w-[54px]" /><col className="w-[102px]" />
                      <col className="w-[180px]" /><col className="w-[220px]" /><col className="w-[116px]" />
                      <col className="w-[116px]" /><col className="w-[128px]" /><col className="w-[42px]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-3">Date</th><th className="px-2 py-3">Day</th><th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">Category</th><th className="px-3 py-3">Description</th>
                        <th className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400">Income</th>
                        <th className="px-3 py-3 text-right text-rose-600 dark:text-rose-400">Expense</th>
                        <th className="px-3 py-3 text-right">Balance</th><th className="px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => {
                        const isToday = r.dateKey === todayKey;
                        const isWeekend = r.weekday === "Sat" || r.weekday === "Sun";
                        return (
                          <tr key={`${r.dateKey}-${idx}`} className={cn("group border-b last:border-0", isWeekend && "bg-muted/20", isToday && "bg-primary/5", "hover:bg-accent/40")}>
                            <td className="px-3 py-2 align-middle">{r.firstOfDay && <span className="tabular-nums font-medium">{r.day} {MONTHS_SHORT[month]}</span>}</td>
                            <td className="px-2 py-2 align-middle">{r.firstOfDay && <span className="text-sm text-muted-foreground">{r.weekday}</span>}</td>
                            <td className="px-3 py-2 align-middle">
                              {r.entry ? (
                                <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", r.kind === "income" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400")}>{r.kind}</span>
                              ) : (r.firstOfDay && <span className="text-muted-foreground/40">—</span>)}
                            </td>
                            <td className="px-3 py-2 align-middle">{r.entry && <CategorySelect entry={r.entry} kind={r.kind as EntryKind} onChange={(c) => commitCategory(r.entry!, c)} />}</td>
                            <td className="px-3 py-2 align-middle">{r.entry && <NoteInput entry={r.entry} onCommit={(t) => commitNote(r.entry!, t)} />}</td>
                            <td className="px-3 py-2 text-right align-middle">
                              {r.kind === "income" || r.kind === null ? (
                                <AmountInput value={r.entry?.amount ?? null} tone="income" onCommit={(num) => commitAmount(r.dateKey, "income", r.entry, num)} />
                              ) : <span className="pr-2 text-muted-foreground/30">–</span>}
                            </td>
                            <td className="px-3 py-2 text-right align-middle">
                              {r.kind === "expense" || r.kind === null ? (
                                <AmountInput value={r.entry?.amount ?? null} tone="expense" onCommit={(num) => commitAmount(r.dateKey, "expense", r.entry, num)} />
                              ) : <span className="pr-2 text-muted-foreground/30">–</span>}
                            </td>
                            <td className={cn("px-3 py-2 text-right align-middle tabular-nums", r.lastOfDay ? (dayBalances[r.dateKey] < 0 ? "text-destructive" : "text-muted-foreground") : "text-transparent")}>
                              {r.lastOfDay ? formatAmount(dayBalances[r.dateKey] ?? 0, currency) : ""}
                            </td>
                            <td className="px-1 py-1 text-center align-middle">
                              {r.entry ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => removeEntry(r.entry!)} aria-label="Delete entry" className="rounded p-1 text-muted-foreground/40 transition hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                                  {r.lastOfDay && (
                                    <button onClick={() => addLine(r.dateKey)} aria-label="Add entry" className="rounded p-1 text-muted-foreground/40 transition hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                                  )}
                                </div>
                              ) : (r.lastOfDay && (
                                <button onClick={() => addLine(r.dateKey)} aria-label="Add entry" className="rounded p-1 text-muted-foreground/40 transition hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/40 font-semibold">
                        <td className="px-2 py-2.5" colSpan={5}>Total</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatAmount(earned, currency)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{formatAmount(spent, currency)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{formatAmount(endBalance, currency)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                </div>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account summary</span>
                  <Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => load({ quiet: true })}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3 p-4">
                  <div className="rounded-2xl border border-input bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wallet (Cash)</p>
                        <p className="mt-2 text-lg font-semibold">{formatAmount(walletBalance, currency)}</p>
                      </div>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                        <Wallet className="h-5 w-5" />
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-input bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Safe (Savings)</p>
                        <p className="mt-2 text-lg font-semibold">{formatAmount(safeBalance, currency)}</p>
                      </div>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                        <PiggyBank className="h-5 w-5" />
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-input bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Net worth</p>
                        <p className="mt-2 text-lg font-semibold">{formatAmount(netWorth, currency)}</p>
                      </div>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Landmark className="h-5 w-5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Savings goal</span>
                  {savingsTarget ? <span className="text-xs text-muted-foreground">{(savingsProgress ?? 0).toFixed(0)}%</span> : null}
                </div>
                <div className="p-4">
                  {savingsTarget ? (
                    <>
                      <p className="text-sm text-muted-foreground">{formatAmount(netWorth, currency)} of {formatAmount(savingsTarget, currency)} saved</p>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, savingsProgress ?? 0)}%` }} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{daysToGoal != null ? `${daysToGoal} days to goal` : "Keep saving to hit your target"}</span>
                        <span>{formatAmount(netWorth, currency)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>Set a savings goal to unlock progress tracking and personalized insights.</p>
                      <Button variant="secondary" size="sm" onClick={() => setBudgetOpen(true)}>Set goal</Button>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financial score</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      financialScoreLabel.tone === "good" && "bg-emerald-500/10 text-emerald-500",
                      financialScoreLabel.tone === "info" && "bg-sky-500/10 text-sky-500",
                      financialScoreLabel.tone === "warn" && "bg-amber-500/10 text-amber-500",
                      financialScoreLabel.tone === "destructive" && "bg-rose-500/10 text-rose-500"
                    )}
                  >
                    {financialScoreLabel.label}
                  </span>
                </div>
                <div className="space-y-4 p-4">
                  <div className="text-4xl font-bold tabular-nums">{financialScore}</div>
                  <p className="text-sm text-muted-foreground">A quick snapshot of your current financial momentum.</p>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${financialScore}%` }} />
                  </div>
                </div>
              </Card>

              {budgetStatus && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget snapshot</span>
                    <span className="text-xs text-muted-foreground">{Math.round(budgetStatus.pctUsed ?? 0)}%</span>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Budget</span>
                        <span>{formatAmount(budgetStatus.budget, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Spent</span>
                        <span>{formatAmount(budgetStatus.spent, currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Remaining</span>
                        <span>{formatAmount(budgetStatus.remaining, currency)}</span>
                      </div>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${budgetStatus.pctUsed ?? 0}%` }} />
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      <span>{budgetStatus.daysElapsed} days elapsed</span>
                      <span>{budgetStatus.daysRemaining} days remaining</span>
                    </div>
                  </div>
                </Card>
              )}
            </aside>
          </div>
        </>
      )}

      {user && (
        <>
          <ExpenseFormDialog
            open={form.open}
            onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}
            userId={user.uid}
            defaultDate={isCurrentMonth ? todayKey : `${mKey}-01`}
            initialKind={form.kind}
            expense={form.expense}
            onSaved={load}
          />
          <BudgetFormDialog open={budgetOpen} onOpenChange={setBudgetOpen} userId={user.uid} budget={budget} onSaved={load} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational
// ---------------------------------------------------------------------------
function Panel({ title, children, bodyClassName, action }: { title: string; children: React.ReactNode; bodyClassName?: string; action?: React.ReactNode }) {
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

function Delta({ pct, good, suffix }: { pct: number; good: boolean; suffix: string }) {
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

function StatCard({ icon: Icon, iconClass, label, value, sub, spark }: {
  icon: LucideIcon; iconClass: string; label: string; value: string; sub?: React.ReactNode; spark?: number[];
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

function QuickAdd({ icon: Icon, label, cls, iconCls, onClick }: { icon: LucideIcon; label: string; cls: string; iconCls: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors", cls)}>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconCls)}><Icon className="h-4 w-4" /></span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function Donut({ data, currency, total }: { data: { category: string; amount: number }[]; currency: ReturnType<typeof resolveCurrency>; total: number }) {
  if (total <= 0) {
    return <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No expenses yet</div>;
  }
  const r = 52, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
        {data.map((d) => {
          const len = (d.amount / total) * c;
          const el = (
            <circle key={d.category} cx={70} cy={70} r={r} fill="none" stroke={categoryColor(d.category)} strokeWidth={16}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          );
          offset += len;
          return el;
        })}
        <text x={70} y={66} textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase">Total</text>
        <text x={70} y={80} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">{formatAmount(total, currency)}</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {data.slice(0, 6).map((d) => {
          const Icon = iconFor(d.category);
          return (
            <li key={d.category} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ backgroundColor: `${categoryColor(d.category)}22`, color: categoryColor(d.category) }}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">{categoryLabel(d.category)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatAmount(d.amount, currency)}</span>
              <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground">{Math.round((d.amount / total) * 100)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IncomeExpenseBars({ income, expense, net, currency }: { income: number; expense: number; net: number; currency: ReturnType<typeof resolveCurrency> }) {
  const max = Math.max(income, expense, 1);
  return (
    <div>
      <div className="flex h-40 items-end justify-around gap-6">
        {[
          { label: "Income", value: income, cls: "bg-emerald-500", text: "text-emerald-500" },
          { label: "Expenses", value: expense, cls: "bg-rose-500", text: "text-rose-500" },
        ].map((b) => (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className={cn("text-sm font-semibold tabular-nums", b.text)}>{formatAmount(b.value, currency)}</span>
            <div className={cn("w-full max-w-[80px] rounded-t transition-all", b.cls)} style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }} />
            <span className="text-xs text-muted-foreground">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Net amount</span>
        <span className={cn("font-semibold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatAmount(net, currency)}</span>
      </div>
    </div>
  );
}

function TrendChart({ data, currency, highlight }: { data: { m: number; income: number; expense: number }[]; currency: ReturnType<typeof resolveCurrency>; highlight: number }) {
  const w = 320, h = 150, padX = 6, padY = 10;
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const x = (i: number) => padX + (i / 11) * (w - padX * 2);
  const y = (v: number) => h - padY - (v / max) * (h - padY * 2);
  const line = (key: "income" | "expense") => data.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No data this year</div>;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full">
        <polyline points={line("income")} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={line("expense")} fill="none" stroke="#f43f5e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.income)} r={i === highlight ? 3 : 2} fill="#10b981" />
            <circle cx={x(i)} cy={y(d.expense)} r={i === highlight ? 3 : 2} fill="#f43f5e" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-muted-foreground">
        {MONTHS_SHORT.map((m, i) => (
          <span key={m} className={cn(i === highlight && "font-semibold text-foreground")}>{m[0]}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Expenses</span>
      </div>
    </div>
  );
}

function Heatmap({ year, month, byDay, todayKey }: {
  year: number; month: number; byDay: Map<string, { income: Expense[]; expense: Expense[]; net: number }>; todayKey: string;
}) {
  const dim = daysInMonth(year, month);
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  let maxAbs = 1;
  for (let d = 1; d <= dim; d++) {
    const b = byDay.get(`${monthKey(year, month)}-${String(d).padStart(2, "0")}`);
    if (b) maxAbs = Math.max(maxAbs, Math.abs(b.net));
  }
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEK_HEADS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day == null) return <span key={`b${i}`} />;
          const key = `${monthKey(year, month)}-${String(day).padStart(2, "0")}`;
          const b = byDay.get(key);
          const n = b?.net ?? 0;
          const intensity = Math.min(1, 0.25 + (Math.abs(n) / maxAbs) * 0.75);
          const bg = n > 0 ? `rgba(16,185,129,${intensity})` : n < 0 ? `rgba(244,63,94,${intensity})` : undefined;
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              title={n !== 0 ? `${formatDayLabel(key)}: ${n > 0 ? "+" : ""}${n}` : formatDayLabel(key)}
              className={cn(
                "flex aspect-square items-center justify-center rounded text-[11px] tabular-nums",
                !bg && "bg-muted/40 text-muted-foreground",
                bg && "font-medium text-white",
                isToday && "ring-2 ring-primary"
              )}
              style={bg ? { backgroundColor: bg } : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Saved more</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Spent more</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable inputs
// ---------------------------------------------------------------------------
function AmountInput({ value, tone, onCommit }: { value: number | null; tone: "income" | "expense"; onCommit: (num: number | null) => void }) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const dirty = useRef(false);
  const commitRef = useRef<() => void>(() => {});
  useEffect(() => { if (!dirty.current) setDraft(value != null ? String(value) : ""); }, [value]);
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

function NoteInput({ entry, onCommit }: { entry: Expense; onCommit: (text: string) => void }) {
  const value = entry.note ?? "";
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const commitRef = useRef<() => void>(() => {});
  useEffect(() => { if (!dirty.current) setDraft(value); }, [value]);
  function commit() {
    dirty.current = false;
    onCommit(draft);
  }
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

function CategorySelect({ entry, kind, onChange }: { entry: Expense; kind: EntryKind; onChange: (category: string) => void }) {
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const label = (c: string) => kind === "income"
    ? INCOME_CATEGORY_LABEL[c as keyof typeof INCOME_CATEGORY_LABEL] ?? c
    : EXPENSE_CATEGORY_LABEL[c as keyof typeof EXPENSE_CATEGORY_LABEL] ?? c;
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
