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
  Copy,
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
  isTransfer,
} from "@/lib/expenses";
import { entriesToCsv, downloadCsv } from "@/lib/export";
import { resolveCurrency, formatAmount, formatAmountCompact } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { TransferDialog } from "@/components/expenses/transfer-dialog";
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
  transfer: ArrowRightLeft,
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
  const [transferOpen, setTransferOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<AccountKey>("wallet");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [amountView, setAmountView] = useState<"full" | "compact">("full");
  const [viewMode, setViewMode] = useState<"table" | "cards" | "calendar">("table");
  const [rangeFilter, setRangeFilter] = useState<"month" | "last30" | "all">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({
    spendingOverview: true,
    incomeExpense: true,
    calendarHeatmap: true,
    recentActivity: true,
    monthlyTrend: true,
  });
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
  const [quickEntry, setQuickEntry] = useState({
    date: todayKey,
    kind: "expense" as EntryKind,
    account: "wallet" as AccountKey,
    category: DEFAULT_CATEGORY["expense"],
    note: "",
    amount: null as number | null,
  });
 
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("finance:amountView");
      if (saved === "full" || saved === "compact") {
        setAmountView(saved);
      }
    } catch {
      // ignore localStorage failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("finance:amountView", amountView);
    } catch {
      // ignore localStorage failures
    }
  }, [amountView]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("finance:viewMode");
      if (saved === "table" || saved === "cards" || saved === "calendar") {
        setViewMode(saved);
      }
    } catch {
      // ignore localStorage failures
    }
    try {
      const saved = window.localStorage.getItem("finance:rangeFilter");
      if (saved === "month" || saved === "last30" || saved === "all") {
        setRangeFilter(saved);
      }
    } catch {
      // ignore localStorage failures
    }
    try {
      const saved = window.localStorage.getItem("finance:visibleWidgets");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        setVisibleWidgets((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore localStorage failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("finance:viewMode", viewMode);
      window.localStorage.setItem("finance:rangeFilter", rangeFilter);
      window.localStorage.setItem("finance:visibleWidgets", JSON.stringify(visibleWidgets));
    } catch {
      // ignore localStorage failures
    }
  }, [viewMode, rangeFilter, visibleWidgets]);

  // Remember the last-used quick-add kind/account/category so repeat entries
  // (e.g. daily coffee) start from where you left off — even after a reload.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("finance:quickDefaults");
      if (!saved) return;
      const d = JSON.parse(saved) as { kind?: EntryKind; account?: AccountKey; category?: string };
      const kind: EntryKind = d.kind === "income" ? "income" : "expense";
      const account: AccountKey = d.account === "safe" ? "safe" : "wallet";
      const validCats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const category = d.category && (validCats as string[]).includes(d.category) ? d.category : DEFAULT_CATEGORY[kind];
      setQuickEntry((prev) => ({ ...prev, kind, account, category }));
    } catch {
      // ignore localStorage failures
    }
  }, []);

  const quickInit = useRef(true);
  useEffect(() => {
    // Skip the initial render so we never overwrite freshly-restored values.
    if (quickInit.current) {
      quickInit.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        "finance:quickDefaults",
        JSON.stringify({ kind: quickEntry.kind, account: quickEntry.account, category: quickEntry.category })
      );
    } catch {
      // ignore localStorage failures
    }
  }, [quickEntry.kind, quickEntry.account, quickEntry.category]);

  const formatDisplayAmount = useCallback(
    (amount: number) => (amountView === "compact" ? formatAmountCompact(amount, currency) : formatAmount(amount, currency)),
    [amountView, currency]
  );
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const inFilter = useCallback(
    (e: Expense) => filter === "all" || e.account === filter,
    [filter]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((e) => inMonth(e.date, mKey) && inFilter(e)),
    [expenses, mKey, inFilter]
  );

  const displayExpenses = useMemo(() => {
    const base = expenses.filter(inFilter);
    const rangeStart = rangeFilter === "last30" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29) : null;
    const rangeEnd = rangeFilter === "last30" ? now : null;
    const ranged = base.filter((e) => {
      if (rangeFilter === "month") return inMonth(e.date, mKey);
      if (rangeFilter === "last30") {
        const date = new Date(`${e.date}T00:00:00`);
        return rangeStart && rangeEnd ? date >= rangeStart && date <= rangeEnd : true;
      }
      return true;
    });
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ranged;
    return ranged.filter((e) => {
      const text = [e.note, e.category, e.account, e.kind, e.date].join(" ").toLowerCase();
      return text.includes(query) || formatAmount(e.amount, currency).includes(query);
    });
  }, [expenses, inFilter, rangeFilter, mKey, now, searchQuery, currency]);

  const visibleExpenses = displayExpenses;
  
  const earned = useMemo(() => totalEarned(visibleExpenses), [visibleExpenses]);
  const spent = useMemo(() => totalSpent(visibleExpenses), [visibleExpenses]);
  const net = earned - spent;
  const savingsRate = earned > 0 ? (net / earned) * 100 : 0;

  const spentToday = useMemo(
    () => totalSpent(visibleExpenses.filter((e) => e.date === todayKey)),
    [visibleExpenses, todayKey]
  );
  const netToday = useMemo(
    () => netTotal(visibleExpenses.filter((e) => e.date === todayKey)),
    [visibleExpenses, todayKey]
  );

  const rangeLabel = rangeFilter === "month" ? monthLabel(year, month) : rangeFilter === "last30" ? "Last 30 days" : "All entries";

  const prev = useMemo(() => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const pe = expenses.filter((e) => inMonth(e.date, monthKey(py, pm)) && inFilter(e));
    return { inc: totalEarned(pe), exp: totalSpent(pe), net: netTotal(pe) };
  }, [expenses, month, year, inFilter]);

  const byDay = useMemo(() => {
    const m = new Map<string, { income: Expense[]; expense: Expense[]; net: number }>();
    for (const e of displayExpenses) {
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
  }, [displayExpenses]);

  const openingTotal = useMemo(
    () => ACCOUNTS.reduce((s, a) => s + (budget?.openingBalances?.[a] ?? 0), 0),
    [budget]
  );
  const walletBalance = accountBalance(expenses, "wallet", budget?.openingBalances?.wallet ?? 0);
  const safeBalance = accountBalance(expenses, "safe", budget?.openingBalances?.safe ?? 0);
  const netWorth = walletBalance + safeBalance;

  const dim = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim]);
 
  const displayDays = useMemo(() => {
    if (rangeFilter === "month") {
      return days.map((day) => `${mKey}-${String(day).padStart(2, "0")}`);
    }
    if (rangeFilter === "last30") {
      return Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29 + i);
        return toDateKey(date);
      });
    }
    return Array.from(new Set(displayExpenses.map((e) => e.date))).sort();
  }, [displayExpenses, rangeFilter, days, mKey, now]);
 
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

  const byCategory = useMemo(() => spendByCategory(visibleExpenses), [visibleExpenses]);

  const recent = useMemo(
    () =>
      [...visibleExpenses]
        .sort((a, b) => b.createdAt - a.createdAt || (a.date < b.date ? 1 : -1))
        .slice(0, 6),
    [visibleExpenses]
  );

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    for (const entry of visibleExpenses) {
      const key = `${entry.date}:${entry.amount}:${entry.category}:${entry.kind}`;
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
    return Array.from(groups.values()).filter((items) => items.length > 1);
  }, [visibleExpenses]);

  const largeTransactions = useMemo(
    () => visibleExpenses.filter((entry) => entry.amount >= 1000).slice().sort((a, b) => b.amount - a.amount).slice(0, 3),
    [visibleExpenses]
  );

  const quickCategories = quickEntry.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const quickCategoryLabels = quickEntry.kind === "income" ? INCOME_CATEGORY_LABEL : EXPENSE_CATEGORY_LABEL;

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
        out.push({ icon: Target, tone: "good", text: `You've reached your ${formatDisplayAmount(savingsTarget)} savings goal! 🎉` });
      else if (daysToGoal != null)
        out.push({ icon: Target, tone: "good", text: `At your current pace you'll hit your goal in ~${daysToGoal} days.` });
      else
        out.push({ icon: Target, tone: "warn", text: `You're not saving this month — add income or trim spending to reach your goal.` });
    }
    if (duplicateGroups.length > 0) {
      out.push({
        icon: Tag,
        tone: "warn",
        text: `Detected ${duplicateGroups.length} duplicate transaction groups in this view.`,
      });
    }
    if (largeTransactions.length > 0) {
      out.push({
        icon: ArrowRightLeft,
        tone: "info",
        text: `Large transaction alert: ${formatDisplayAmount(largeTransactions[0].amount)} on ${largeTransactions[0].date}.`, 
      });
    }
    if (isCurrentMonth) {
      out.push(
        netToday >= 0
          ? { icon: Sparkles, tone: "good", text: `Today you're net ${formatDisplayAmount(netToday)}.` }
          : { icon: Sparkles, tone: "info", text: `You've spent ${formatDisplayAmount(spentToday)} today.` }
      );
    }
    return out.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev, spent, byCategory, savingsTarget, savingsProgress, daysToGoal, netToday, spentToday, isCurrentMonth, currency, duplicateGroups, largeTransactions]);

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
  async function submitQuickEntry() {
    if (!user || quickEntry.amount == null || quickEntry.amount <= 0) return;
    const draft = {
      kind: quickEntry.kind,
      amount: quickEntry.amount,
      account: quickEntry.account,
      category: quickEntry.category,
      note: quickEntry.note.trim() || null,
      date: quickEntry.date,
    };
    try {
      const id = await createExpense(user.uid, draft);
      setExpenses((p) => [...p, { id, userId: user.uid, createdAt: Date.now(), ...draft }] as Expense[]);
      setQuickEntry((prev) => ({ ...prev, amount: null, note: "", date: todayKey }));
    } catch {
      await load({ quiet: true });
    }
  }
  async function duplicateEntry(entry: Expense) {
    if (!user) return;
    const draft = {
      kind: entry.kind,
      amount: entry.amount,
      account: entry.account,
      category: entry.category,
      note: entry.note,
      date: entry.date,
    };
    try {
      const id = await createExpense(user.uid, draft);
      setExpenses((p) => [...p, { id, userId: user.uid, createdAt: Date.now(), ...draft }]);
    } catch {
      await load({ quiet: true });
    }
  }
  function exportCsv(scope: "month" | "all" | "view") {
    const data =
      scope === "month" ? monthExpenses : scope === "all" ? expenses : displayExpenses;
    if (data.length === 0) return;
    const fileName =
      scope === "month" ? `finance-${mKey}.csv` : scope === "all" ? "finance-all.csv" : `finance-${rangeFilter}.csv`;
    downloadCsv(fileName, entriesToCsv(data));
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
      dateKey: string; day: number; month: string; weekday: string;
      firstOfDay: boolean; lastOfDay: boolean;
      entry?: Expense; kind: EntryKind | null;
    }[] = [];
    for (const dateKey of displayDays) {
      const date = new Date(`${dateKey}T00:00:00`);
      const day = date.getDate();
      const weekday = WEEKDAYS_SHORT[date.getDay()];
      const monthName = MONTHS_SHORT[date.getMonth()];
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
          dateKey,
          day,
          month: monthName,
          weekday,
          firstOfDay: i === 0,
          lastOfDay: i === total - 1,
          entry: rec?.entry,
          kind: rec?.kind ?? null,
        });
      }
    }
    return out;
  }, [displayDays, byDay, extraRows]);

  const firstName = resolveFirstName(displayName, user?.email ?? null);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header — title + primary actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">
            {greeting()}, {firstName}! <span className="align-middle">👋</span>
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s your financial overview for {rangeLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openAdd("expense")}>
            <Plus className="h-4 w-4" /> Add transaction
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Export"><Download className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportCsv("month")}>This month (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv("view")}>Current view (CSV)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv("all")}>All time (CSV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" aria-label="Settings" onClick={() => setBudgetOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter bar — time range · search · view options */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2">
        <div className="flex items-center gap-2">
          {rangeFilter === "month" && (
            <div className="flex items-center rounded-lg border bg-background">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={prevMonth} className="h-9 w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[92px] text-center text-sm font-medium">{monthLabel(year, month)}</span>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={nextMonth} className="h-9 w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Select value={rangeFilter} onValueChange={(v) => setRangeFilter(v as "month" | "last30" | "all")}>
            <SelectTrigger className="h-9 w-[132px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="last30">Last 30 days</SelectItem>
              <SelectItem value="all">All entries</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Input
          placeholder="Search transactions…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-9 min-w-[150px] flex-1"
        />

        <Select value={filter} onValueChange={(v) => setFilter(v as AccountFilter)}>
          <SelectTrigger className="h-9 w-[128px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{ACCOUNT_LABEL[a]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "cards" | "calendar")}>
          <SelectTrigger className="h-9 w-[116px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="cards">Cards</SelectItem>
            <SelectItem value="calendar">Calendar</SelectItem>
          </SelectContent>
        </Select>

        {/* Amount format — compact segmented toggle showing example output */}
        <div className="flex items-center rounded-lg border bg-background p-0.5" role="group" aria-label="Number format">
          {(["full", "compact"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={amountView === m}
              onClick={() => setAmountView(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                amountView === m ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "full" ? "1,234" : "1.2k"}
            </button>
          ))}
        </div>
      </div>

      {/* Widget toggles */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2 text-sm text-muted-foreground">
        <span className="px-1.5 text-xs font-medium uppercase tracking-wide">Widgets</span>
        {Object.entries(visibleWidgets).map(([key, visible]) => (
          <Button
            key={key}
            variant={visible ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setVisibleWidgets((prev) => ({ ...prev, [key]: !prev[key] }))}
          >
            {key === "spendingOverview" ? "Spending" : key === "incomeExpense" ? "Income" : key === "calendarHeatmap" ? "Heatmap" : key === "recentActivity" ? "Recent" : "Trend"}
          </Button>
        ))}
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
              value={formatDisplayAmount(netWorth)}
              sub={<span className="text-xs text-muted-foreground">Across all accounts</span>}
              spark={sparkData}
            />
            <StatCard
              icon={Wallet}
              iconClass="bg-sky-500/15 text-sky-500"
              label="Wallet (cash)"
              value={formatDisplayAmount(walletBalance)}
              sub={<span className="text-xs text-muted-foreground">Available to spend</span>}
            />
            <StatCard
              icon={PiggyBank}
              iconClass="bg-emerald-500/15 text-emerald-500"
              label="Safe (savings)"
              value={formatDisplayAmount(safeBalance)}
              sub={<span className="text-xs text-muted-foreground">Keep building 💪</span>}
            />
            <StatCard
              icon={net >= 0 ? TrendingUp : TrendingDown}
              iconClass={net >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}
              label="Net this period"
              value={formatDisplayAmount(net)}
              sub={
                rangeFilter === "month" ? (
                  <Delta pct={pctChange(net, prev.net)} good={net >= prev.net} suffix="vs last month" />
                ) : (
                  <span className="text-xs text-muted-foreground">Income − expenses</span>
                )
              }
            />
            <StatCard
              icon={Target}
              iconClass="bg-violet-500/15 text-violet-500"
              label="Savings goal"
              value={              savingsTarget ? formatDisplayAmount(savingsTarget) : "—"}              sub={
                savingsTarget ? (
                  <div className="mt-1 space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, savingsProgress ?? 0)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(savingsProgress ?? 0).toFixed(0)}% · {formatDisplayAmount(netWorth)}
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
                {visibleWidgets.spendingOverview && (
                  <Panel title="Spending overview">
                    <Donut data={byCategory} currency={currency} total={spent} formatAmountDisplay={formatDisplayAmount} />
                  </Panel>
                )}
                {visibleWidgets.incomeExpense && (
                  <Panel title="Income vs expenses" action={<Button variant="ghost" size="sm" onClick={() => exportCsv("month")}>Export</Button>}>
                    <IncomeExpenseBars income={earned} expense={spent} net={net} currency={currency} formatAmountDisplay={formatDisplayAmount} />
                  </Panel>
                )}
                {visibleWidgets.calendarHeatmap && (
                  <Panel title="Calendar heatmap" action={<span className="text-xs text-muted-foreground">{displayDays.length} days</span>}>
                    <Heatmap year={year} month={month} byDay={byDay} todayKey={todayKey} />
                  </Panel>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                <div className="grid gap-4 lg:grid-cols-2">
                  {visibleWidgets.recentActivity && (
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
                                  {e.kind === "income" ? "+" : "−"}{formatDisplayAmount(e.amount)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Panel>
                  )}
                  {visibleWidgets.monthlyTrend && (
                    <Panel title="Monthly trend">
                      <TrendChart data={monthly} currency={currency} highlight={month} />
                    </Panel>
                  )}
                </div>

                <Panel title="Quick add">
                  <div className="grid grid-cols-2 gap-3">
                    <QuickAdd icon={TrendingUp} label="Income" cls="hover:border-emerald-500/60 hover:bg-emerald-500/5" iconCls="bg-emerald-500/15 text-emerald-500" onClick={() => openAdd("income")} />
                    <QuickAdd icon={TrendingDown} label="Expense" cls="hover:border-rose-500/60 hover:bg-rose-500/5" iconCls="bg-rose-500/15 text-rose-500" onClick={() => openAdd("expense")} />
                    <QuickAdd icon={ArrowRightLeft} label="Transfer" cls="hover:border-sky-500/60 hover:bg-sky-500/5" iconCls="bg-sky-500/15 text-sky-500" onClick={() => setTransferOpen(true)} />
                    <QuickAdd icon={Settings2} label="Settings" cls="hover:border-primary/60 hover:bg-primary/5" iconCls="bg-primary/15 text-primary" onClick={() => setBudgetOpen(true)} />
                  </div>
                  <div className="mt-4 space-y-2 rounded-lg border p-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="font-semibold tabular-nums text-emerald-500">{formatDisplayAmount(earned)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span className="font-semibold tabular-nums text-rose-500">{formatDisplayAmount(spent)}</span></div>
                    <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Net</span><span className={cn("font-semibold tabular-nums", net >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatDisplayAmount(net)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Savings rate</span><span className="font-semibold tabular-nums">{savingsRate.toFixed(1)}%</span></div>
                  </div>
                </Panel>
              </div>

              <Panel title="Transactions" bodyClassName="p-0">
                <div className="space-y-4 border-b border-muted/20 bg-background/80 px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-[160px_100px_160px_140px_1fr_120px_120px]">
                    <Input
                      type="date"
                      value={quickEntry.date}
                      onChange={(event) => setQuickEntry((prev) => ({ ...prev, date: event.target.value }))}
                      className="h-10"
                    />
                    <select
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={quickEntry.kind}
                      onChange={(event) => setQuickEntry((prev) => ({ ...prev, kind: event.target.value as EntryKind, category: DEFAULT_CATEGORY[event.target.value as EntryKind] }))}
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                    <select
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={quickEntry.category}
                      onChange={(event) => setQuickEntry((prev) => ({ ...prev, category: event.target.value }))}
                    >
                      {quickCategories.map((cat) => (
                        <option key={cat} value={cat}>{quickCategoryLabels[cat as keyof typeof quickCategoryLabels]}</option>
                      ))}
                    </select>
                    <select
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={quickEntry.account}
                      onChange={(event) => setQuickEntry((prev) => ({ ...prev, account: event.target.value as AccountKey }))}
                    >
                      {ACCOUNTS.map((a) => (
                        <option key={a} value={a}>{ACCOUNT_LABEL[a]}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Description"
                      value={quickEntry.note}
                      onChange={(event) => setQuickEntry((prev) => ({ ...prev, note: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === "Enter") submitQuickEntry(); }}
                      className="h-10"
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={quickEntry.amount ?? ""}
                      onChange={(event) => setQuickEntry((prev) => ({ ...prev, amount: event.target.value ? Number(event.target.value) : null }))}
                      onKeyDown={(event) => { if (event.key === "Enter") submitQuickEntry(); }}
                      className="h-10"
                    />
                    <Button className="h-10" onClick={submitQuickEntry}>
                      Add
                    </Button>
                  </div>
                </div>
                <div className="max-h-[680px] overflow-y-auto p-4">
                  {viewMode === "table" ? (
                    <div className="overflow-x-auto min-w-full">
                      <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
                        <colgroup>
                          <col className="w-[86px]" /><col className="w-[54px]" /><col className="w-[102px]" />
                          <col className="w-[180px]" /><col className="w-[220px]" /><col className="w-[116px]" />
                          <col className="w-[116px]" /><col className="w-[128px]" /><col className="w-[92px]" />
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
                                <td className="px-3 py-2 align-middle">{r.firstOfDay && <span className="tabular-nums font-medium">{r.day} {r.month}</span>}</td>
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
                                  {r.lastOfDay ? formatDisplayAmount(dayBalances[r.dateKey] ?? 0) : ""}
                                </td>
                                <td className="px-1 py-1 text-center align-middle">
                                  {r.entry ? (
                                    <div className="flex items-center justify-center gap-0.5">
                                      <button onClick={() => duplicateEntry(r.entry!)} aria-label="Duplicate entry" title="Duplicate" className="rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"><Copy className="h-3.5 w-3.5" /></button>
                                      <button onClick={() => removeEntry(r.entry!)} aria-label="Delete entry" title="Delete" className="rounded p-1 text-muted-foreground/40 transition hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                                      {r.lastOfDay && (
                                        <button onClick={() => addLine(r.dateKey)} aria-label="Add entry" title="Add row" className="rounded p-1 text-muted-foreground/40 transition hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
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
                            <td className="px-2 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatDisplayAmount(earned)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{formatDisplayAmount(spent)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{formatDisplayAmount(endBalance)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : viewMode === "cards" ? (
                    displayExpenses.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">No transactions in this view.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {displayExpenses.slice().sort((a, b) => b.createdAt - a.createdAt).map((entry) => {
                          const Icon = iconFor(entry.category);
                          const color = categoryColor(entry.category);
                          const transfer = isTransfer(entry);
                          const income = entry.kind === "income";
                          return (
                            <div key={entry.id} className="group flex items-center gap-3 rounded-2xl border bg-background p-3.5 transition-shadow hover:shadow-sm">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22`, color }}>
                                <Icon className="h-5 w-5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{entry.note || categoryLabel(entry.category)}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {formatDayLabel(entry.date)} · {categoryLabel(entry.category)} · {ACCOUNT_LABEL[entry.account]}
                                </p>
                              </div>
                              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", transfer ? "text-sky-500" : income ? "text-emerald-500" : "text-rose-500")}>
                                {transfer ? "" : income ? "+" : "−"}{formatDisplayAmount(entry.amount)}
                              </span>
                              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <button onClick={() => duplicateEntry(entry)} aria-label="Duplicate" title="Duplicate" className="rounded p-1 text-muted-foreground/50 transition hover:bg-accent hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                                <button onClick={() => removeEntry(entry)} aria-label="Delete" title="Delete" className="rounded p-1 text-muted-foreground/50 transition hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {rangeFilter === "month" && (
                        <div className="rounded-2xl border bg-background p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{monthLabel(year, month)}</p>
                            <span className="text-xs text-muted-foreground">green = saved · red = spent</span>
                          </div>
                          <div className="mt-4">
                            <Heatmap year={year} month={month} byDay={byDay} todayKey={todayKey} />
                          </div>
                        </div>
                      )}
                      {(() => {
                        const activeDays = displayDays.filter((d) => byDay.has(d)).reverse();
                        if (activeDays.length === 0) {
                          return <p className="py-12 text-center text-sm text-muted-foreground">No activity in this view.</p>;
                        }
                        return (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {activeDays.map((dateKey) => {
                              const b = byDay.get(dateKey) ?? { income: [], expense: [], net: 0 };
                              const count = b.income.length + b.expense.length;
                              const isToday = dateKey === todayKey;
                              return (
                                <div key={dateKey} className={cn("rounded-2xl border bg-background p-4", isToday && "ring-1 ring-primary")}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold">{formatDayLabel(dateKey)}</p>
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {WEEKDAYS_SHORT[new Date(`${dateKey}T00:00:00`).getDay()]} · {count} {count === 1 ? "entry" : "entries"}
                                      </p>
                                    </div>
                                    <span className={cn("rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums", b.net >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
                                      {b.net >= 0 ? "+" : "−"}{formatDisplayAmount(Math.abs(b.net))}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                                    <span className="text-emerald-600 dark:text-emerald-400">↑ {formatDisplayAmount(totalEarned(b.income))}</span>
                                    <span className="text-rose-600 dark:text-rose-400">↓ {formatDisplayAmount(totalSpent(b.expense))}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
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
                        <p className="mt-2 text-lg font-semibold">{formatDisplayAmount(walletBalance)}</p>
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
                        <p className="mt-2 text-lg font-semibold">{formatDisplayAmount(safeBalance)}</p>
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
                        <p className="mt-2 text-lg font-semibold">{formatDisplayAmount(netWorth)}</p>
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
                      <p className="text-sm text-muted-foreground">{formatDisplayAmount(netWorth)} of {formatDisplayAmount(savingsTarget)} saved</p>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, savingsProgress ?? 0)}%` }} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{daysToGoal != null ? `${daysToGoal} days to goal` : "Keep saving to hit your target"}</span>
                        <span>{formatDisplayAmount(netWorth)}</span>
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
                        <span>{formatDisplayAmount(budgetStatus.budget)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Spent</span>
                        <span>{formatDisplayAmount(budgetStatus.spent)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Remaining</span>
                        <span>{formatDisplayAmount(budgetStatus.remaining)}</span>
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
          <TransferDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            userId={user.uid}
            defaultDate={isCurrentMonth ? todayKey : `${mKey}-01`}
            onSaved={load}
          />
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

function Donut({ data, currency, total, formatAmountDisplay }: { data: { category: string; amount: number }[]; currency: ReturnType<typeof resolveCurrency>; total: number; formatAmountDisplay: (amount: number) => string }) {
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
        <text x={70} y={80} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">{formatAmountDisplay(total)}</text>
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
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatAmountDisplay(d.amount)}</span>
              <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground">{Math.round((d.amount / total) * 100)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IncomeExpenseBars({ income, expense, net, currency, formatAmountDisplay }: { income: number; expense: number; net: number; currency: ReturnType<typeof resolveCurrency>; formatAmountDisplay: (amount: number) => string }) {
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

function NoteInput({ entry, onCommit }: { entry: Expense; onCommit: (text: string) => void }) {
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

function CategorySelect({ entry, kind, onChange }: { entry: Expense; kind: EntryKind; onChange: (category: string) => void }) {
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
