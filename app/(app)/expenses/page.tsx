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
  Repeat,
  Check,
  Trash2,
  Tv,
  Music,
  Film,
  Cloud,
  Home,
  Shield,
  Wifi,
  Smartphone,
  Zap,
  Newspaper,
  CreditCard,
  Pencil,
  Star,
  Eye,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getExpenses,
  getBudget,
  createExpense,
  updateExpense,
  deleteExpense,
  deleteExpenses,
  setRecurringRules,
  setBudgetAccounts,
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
  spendByCategory,
  categoryColor,
  categoryLabel,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABEL,
  isTransfer,
  seedAccounts,
  normalizeAccount,
  sortAccounts,
  activeAccounts,
  accountById,
  computeAccountBalance,
} from "@/lib/expenses";
import {
  isDue,
  isPostedForCurrentPeriod,
  nextRenewal,
  currentPeriodDate,
  dateKey as recurringDateKey,
  daysUntil,
  monthlyEquivalent,
  renewalsInMonth,
  RECURRING_FREQUENCY_ABBREV,
} from "@/lib/recurring";
import { entriesToCsv, downloadCsv } from "@/lib/export";
import { resolveCurrency, formatAmount, formatAmountCompact, type Currency } from "@/lib/currency";
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
import { AccountManagerDialog } from "@/components/expenses/account-manager-dialog";
import { CashCounterDialog } from "@/components/expenses/cash-counter-dialog";
import { RecurringDialog } from "@/components/expenses/recurring-dialog";
import { DuplicatesDialog } from "@/components/expenses/duplicates-dialog";
import { ConfirmDialog } from "@/components/expenses/confirm-dialog";
import {
  Panel,
  Delta,
  StatCard,
  QuickAdd,
  IncomeExpenseBars,
  AmountInput,
  NoteInput,
  CategorySelect,
} from "@/components/expenses/finance-widgets";
import { cn } from "@/lib/utils";
import type { Account, Budget, EntryKind, Expense, RecurringRule } from "@/lib/types";
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

// Best-effort "logo" for a recurring subscription, matched from its name/category.
const SUB_ICON_RULES: { icon: LucideIcon; keys: string[] }[] = [
  { icon: Tv, keys: ["netflix", "hbo", "disney", "hulu", "prime video", "stream", "tv", "movie", "cinema"] },
  { icon: Music, keys: ["spotify", "music", "apple music", "tidal", "deezer", "soundcloud", "audible", "podcast"] },
  { icon: Film, keys: ["youtube", "twitch", "video", "vimeo"] },
  { icon: Cloud, keys: ["icloud", "dropbox", "drive", "storage", "backup", "aws", "azure", "cloud", "hosting", "domain", "vps", "server"] },
  { icon: Home, keys: ["rent", "mortgage", "housing", "apartment", "landlord"] },
  { icon: Shield, keys: ["insurance", "vpn", "antivirus", "security", "nordvpn"] },
  { icon: Wifi, keys: ["internet", "wifi", "broadband", "fiber", "router"] },
  { icon: Smartphone, keys: ["phone", "mobile", "sim", "cellular", "carrier", "telecom"] },
  { icon: Zap, keys: ["electric", "utility", "gas", "water", "power", "energy", "heating"] },
  { icon: Newspaper, keys: ["news", "magazine", "medium", "substack", "times"] },
  { icon: Dumbbell, keys: ["gym", "fitness", "workout", "training", "yoga", "pilates"] },
  { icon: GraduationCap, keys: ["course", "tuition", "udemy", "coursera", "class", "learning", "school"] },
  { icon: CreditCard, keys: ["loan", "credit", "installment", "repayment"] },
];
function subscriptionIcon(rule: { note: string | null; category: string }): LucideIcon {
  const hay = `${rule.note ?? ""} ${rule.category}`.toLowerCase();
  for (const { icon, keys } of SUB_ICON_RULES) {
    if (keys.some((k) => hay.includes(k))) return icon;
  }
  return iconFor(rule.category);
}
function renewalText(days: number): string {
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

type AccountFilter = string; // "all" or an account id

// Session cache: re-opening Finance renders instantly from the last fetch while
// a quiet background refresh runs, instead of a full skeleton reload each time.
let financeCache: { uid: string; expenses: Expense[]; budget: Budget | null } | null = null;

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
  const [expenses, setExpenses] = useState<Expense[]>(() => financeCache?.expenses ?? []);
  const [budget, setBudget] = useState<Budget | null>(() => financeCache?.budget ?? null);
  const [loading, setLoading] = useState(() => !financeCache);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [revealedAccts, setRevealedAccts] = useState<Set<string>>(new Set());
  const [dragAcct, setDragAcct] = useState<string | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clearTarget, setClearTarget] = useState<{ ids: string[]; scope: string } | null>(null);
  const [newAccount, setNewAccount] = useState<string>("wallet");
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
      const cached = financeCache && financeCache.uid === user.uid ? financeCache : null;
      if (cached && !opts?.quiet) {
        // Render the cached snapshot immediately; refresh quietly below.
        setExpenses(cached.expenses);
        setBudget(cached.budget);
        setLoading(false);
      } else if (!opts?.quiet) {
        setLoading(true);
      }
      try {
        const [ex, bg] = await Promise.all([getExpenses(user.uid), getBudget(user.uid)]);
        setExpenses(ex);
        setBudget(bg);
        financeCache = { uid: user.uid, expenses: ex, budget: bg };
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

  // User-defined accounts (embedded on the budget). Seed wallet/safe for legacy
  // data so existing transactions keep their account reference.
  const accounts = useMemo(() => {
    const raw = budget?.accounts ?? [];
    const list = raw.length ? raw.map(normalizeAccount) : seedAccounts(budget);
    return sortAccounts(list);
  }, [budget]);
  const primaryAccount = useMemo(
    () => accounts.find((a) => a.isPrimary && !a.archived) ?? null,
    [accounts]
  );

  async function reorderAccounts(fromId: string, toId: string) {
    if (!user || fromId === toId) return;
    const ordered = sortAccounts(accounts);
    const from = ordered.findIndex((a) => a.id === fromId);
    const to = ordered.findIndex((a) => a.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const next = ordered.map((a, i) => ({ ...a, order: i }));
    setBudget((b) => (b ? { ...b, accounts: next } : b)); // optimistic
    try {
      await setBudgetAccounts(user.uid, next);
    } catch {
      load({ quiet: true });
    }
  }
  const activeAccts = useMemo(() => activeAccounts(accounts), [accounts]);
  const acctMap = useMemo(() => accountById(accounts), [accounts]);
  const accountName = useCallback(
    (id: string) => acctMap.get(id)?.name ?? id,
    [acctMap]
  );
  const [quickEntry, setQuickEntry] = useState({
    date: todayKey,
    kind: "expense" as EntryKind,
    account: "wallet" as string,
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
        // Only merge known widget keys so removed widgets can't come back.
        setVisibleWidgets((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(prev)) {
            if (typeof parsed[k] === "boolean") next[k] = parsed[k];
          }
          return next;
        });
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
      const d = JSON.parse(saved) as { kind?: EntryKind; account?: string; category?: string };
      const kind: EntryKind = d.kind === "income" ? "income" : "expense";
      const account = typeof d.account === "string" && d.account ? d.account : "wallet";
      const validCats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const category = d.category && (validCats as string[]).includes(d.category) ? d.category : DEFAULT_CATEGORY[kind];
      setQuickEntry((prev) => ({ ...prev, kind, account, category }));
    } catch {
      // ignore localStorage failures
    }
  }, []);

  // One-time: persist the seeded accounts so they gain stable ids/createdAt.
  useEffect(() => {
    if (!user || !budget) return;
    if (!budget.accounts || budget.accounts.length === 0) {
      setBudgetAccounts(
        user.uid,
        seedAccounts(budget).map((a) => ({ ...a, createdAt: Date.now() }))
      )
        .then(() => load({ quiet: true }))
        .catch(() => {});
    }
  }, [user, budget, load]);

  // Pre-select the primary account in Quick Add (once accounts load), and keep
  // the selected account valid as accounts change.
  const primaryApplied = useRef(false);
  useEffect(() => {
    if (activeAccts.length === 0) return;
    const ids = new Set(activeAccts.map((a) => a.id));
    const fallback = primaryAccount?.id ?? activeAccts[0].id;
    if (!primaryApplied.current) {
      primaryApplied.current = true;
      if (primaryAccount) setQuickEntry((prev) => ({ ...prev, account: primaryAccount.id }));
    }
    if (!ids.has(quickEntry.account)) setQuickEntry((prev) => ({ ...prev, account: fallback }));
    if (!ids.has(newAccount)) setNewAccount(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccts, primaryAccount]);

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
    () => activeAccts.reduce((s, a) => s + a.startingBalance, 0),
    [activeAccts]
  );
  const accountBalances = useMemo(
    () => activeAccts.map((a) => ({ account: a, balance: computeAccountBalance(a, expenses) })),
    [activeAccts, expenses]
  );
  // Net worth is grouped per currency — summing across currencies without a rate
  // is meaningless, so each currency keeps its own subtotal.
  const netWorthByCurrency = useMemo(() => {
    const groups = new Map<string, { currency: Currency; total: number }>();
    for (const { account, balance } of accountBalances) {
      const cur = account.currency ? resolveCurrency({ currency: account.currency }) : currency;
      const g = groups.get(cur.code) ?? { currency: cur, total: 0 };
      g.total += balance;
      groups.set(cur.code, g);
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.currency.code === currency.code
        ? -1
        : b.currency.code === currency.code
          ? 1
          : a.currency.code.localeCompare(b.currency.code)
    );
  }, [accountBalances, currency]);
  // The headline "net worth" is the budget-currency subtotal; other currencies
  // are shown alongside, never blended into it.
  const netWorth = netWorthByCurrency.find((g) => g.currency.code === currency.code)?.total ?? 0;
  const otherCurrencyTotals = netWorthByCurrency.filter((g) => g.currency.code !== currency.code);

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

  const byCategory = useMemo(() => spendByCategory(visibleExpenses), [visibleExpenses]);

  // Per-category budgets: cap (from the budget doc) vs this-month spend.
  const categoryBudgets = useMemo(() => {
    const caps = budget?.byCategory ?? {};
    const spentMap = new Map(spendByCategory(monthExpenses).map((c) => [c.category, c.amount]));
    return Object.entries(caps)
      .filter(([, cap]) => typeof cap === "number" && (cap as number) > 0)
      .map(([category, cap]) => ({ category, cap: cap as number, spent: spentMap.get(category) ?? 0 }))
      .sort((a, b) => b.spent / b.cap - a.spent / a.cap);
  }, [budget, monthExpenses]);

  // Recurring rules (embedded on the budget doc) + subscription tracking.
  const recurring = useMemo<RecurringRule[]>(() => budget?.recurring ?? [], [budget]);
  const activeRecurring = useMemo(() => recurring.filter((r) => r.active), [recurring]);
  const dueRecurring = useMemo(() => recurring.filter((r) => isDue(r, now)), [recurring, now]);
  // Monthly-equivalent overhead of active recurring expenses (subscriptions/bills).
  const monthlyOverhead = useMemo(
    () => activeRecurring.filter((r) => r.kind === "expense").reduce((s, r) => s + monthlyEquivalent(r), 0),
    [activeRecurring]
  );
  const upcomingRenewals = useMemo(
    () =>
      activeRecurring
        .map((r) => {
          const date = nextRenewal(r, now);
          return { rule: r, date, days: daysUntil(date, now) };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [activeRecurring, now]
  );
  // Days in the displayed month that have a renewal, for the calendar heatmap.
  const renewalMarks = useMemo(() => {
    const byDayNum = renewalsInMonth(recurring, year, month);
    const out = new Map<number, string[]>();
    for (const [day, rules] of byDayNum) out.set(day, rules.map((r) => r.note || categoryLabel(r.category)));
    return out;
  }, [recurring, year, month]);

  // Bulk selection for clearing rows (table view).
  const selectedIds = useMemo(
    () => displayExpenses.filter((e) => selected.has(e.id)).map((e) => e.id),
    [displayExpenses, selected]
  );
  const allSelected = displayExpenses.length > 0 && selectedIds.length === displayExpenses.length;

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
    const soonRenewal = upcomingRenewals.find((u) => u.rule.kind === "expense" && u.days <= 3);
    if (soonRenewal) {
      out.push({
        icon: Repeat,
        tone: "warn",
        text: `${soonRenewal.rule.note || categoryLabel(soonRenewal.rule.category)} renews ${renewalText(soonRenewal.days)} (${formatDisplayAmount(soonRenewal.rule.amount)}).`,
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
  }, [prev, spent, byCategory, savingsTarget, savingsProgress, daysToGoal, netToday, spentToday, isCurrentMonth, currency, duplicateGroups, largeTransactions, upcomingRenewals]);

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
  const saveRecurring = useCallback(
    async (rules: RecurringRule[]) => {
      if (!user) return;
      setBudget((b) =>
        b
          ? { ...b, recurring: rules }
          : { userId: user.uid, currency: "MDL", monthlyTotal: null, byCategory: {}, openingBalances: {}, savingsGoal: null, recurring: rules }
      );
      try {
        await setRecurringRules(user.uid, rules);
      } catch {
        await load({ quiet: true });
      }
    },
    [user, load]
  );
  // Post one or more recurring rules into the current month in a single batch so
  // their "posted this month" stamps are written together (no last-write-wins).
  const postRules = useCallback(
    async (toPost: RecurringRule[]) => {
      if (!user || toPost.length === 0) return;
      const ids = new Set(toPost.map((r) => r.id));
      const drafts = toPost.map((rule) => ({
        kind: rule.kind,
        amount: rule.amount,
        account: rule.account,
        category: rule.category,
        note: rule.note,
        date: recurringDateKey(currentPeriodDate(rule, now)),
      }));
      try {
        const created = await Promise.all(drafts.map((d) => createExpense(user.uid, d)));
        const stamp = Date.now();
        setExpenses((p) => [
          ...p,
          ...created.map((id, i) => ({ id, userId: user.uid, createdAt: stamp + i, ...drafts[i] })),
        ]);
        const updated = recurring.map((r) =>
          ids.has(r.id) ? { ...r, lastPosted: recurringDateKey(currentPeriodDate(r, now)) } : r
        );
        setBudget((b) => (b ? { ...b, recurring: updated } : b));
        await setRecurringRules(user.uid, updated);
      } catch {
        await load({ quiet: true });
      }
    },
    [user, now, recurring, load]
  );

  // Auto-post any `autopost` rules that are due this month — once per mount,
  // after the initial load. The lastPosted stamp prevents double-posting.
  const autopostRan = useRef(false);
  useEffect(() => {
    if (autopostRan.current) return;
    if (loading || !user) return;
    autopostRan.current = true;
    const auto = dueRecurring.filter((r) => r.autopost);
    if (auto.length > 0) void postRules(auto);
  }, [loading, user, dueRecurring, postRules]);

  // --- Bulk clear ------------------------------------------------------------
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(displayExpenses.map((e) => e.id)));
  }
  function requestClearSelected() {
    if (selectedIds.length === 0) return;
    setClearTarget({
      ids: selectedIds,
      scope: `${selectedIds.length} selected transaction${selectedIds.length === 1 ? "" : "s"}`,
    });
  }
  function requestClearView() {
    const ids = displayExpenses.map((e) => e.id);
    if (ids.length === 0) return;
    const scope =
      rangeFilter === "month"
        ? `all ${ids.length} transaction${ids.length === 1 ? "" : "s"} in ${monthLabel(year, month)}`
        : `all ${ids.length} transaction${ids.length === 1 ? "" : "s"} in the current view`;
    setClearTarget({ ids, scope });
  }
  async function confirmClear() {
    if (!clearTarget) return;
    const idSet = new Set(clearTarget.ids);
    setExpenses((p) => p.filter((e) => !idSet.has(e.id)));
    setSelected(new Set());
    try {
      await deleteExpenses(clearTarget.ids);
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
            {activeAccts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
            {key === "spendingOverview" ? "Spending" : key === "incomeExpense" ? "Income" : key === "calendarHeatmap" ? "Heatmap" : "Recent"}
          </Button>
        ))}
      </div>
 
      {loading ? (
        <SkeletonCard lines={12} />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              icon={Landmark}
              iconClass="bg-primary/15 text-primary"
              label="Current money"
              value={formatDisplayAmount(netWorth)}
              sub={
                otherCurrencyTotals.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    + {otherCurrencyTotals.map((g) => formatAmount(g.total, g.currency)).join(" · ")}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Across all accounts</span>
                )
              }
              spark={sparkData}
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

          {/* Accounts — your cards */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Accounts &amp; cards
              </h2>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setCashOpen(true)}>
                  Count cash
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAccountsOpen(true)}>
                  <Settings2 className="h-3.5 w-3.5" /> Manage
                </Button>
              </div>
            </div>
            {accountBalances.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center gap-2 p-10 text-center">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">No accounts yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Add a card or wallet to track each balance separately and tag
                    every transaction to it.
                  </p>
                  <Button size="sm" onClick={() => setAccountsOpen(true)}>
                    <Plus className="h-4 w-4" /> Add your first card
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {accountBalances.map(({ account, balance }) => {
                  const color = account.color ?? "#64748b";
                  const isActive = filter === account.id;
                  const revealed = !account.hideBalance || revealedAccts.has(account.id);
                  const acctCur = account.currency ? resolveCurrency({ currency: account.currency }) : currency;
                  return (
                    <div
                      key={account.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={() => setDragAcct(account.id)}
                      onDragEnd={() => setDragAcct(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragAcct) reorderAccounts(dragAcct, account.id);
                        setDragAcct(null);
                      }}
                      onClick={() => setFilter(isActive ? "all" : account.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setFilter(isActive ? "all" : account.id);
                      }}
                      title="Show this account's transactions"
                      className={cn(
                        "group relative flex min-h-[132px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all duration-150 ease-smooth hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
                        isActive && "ring-2 ring-primary",
                        dragAcct === account.id && "opacity-50"
                      )}
                      style={{ borderColor: `${color}55`, background: `linear-gradient(135deg, ${color}26, ${color}0d)` }}
                    >
                      <div className="flex items-start justify-between">
                        {account.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={account.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${color}2e`, color }}>
                            {account.icon ?? account.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {account.isPrimary && (
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-label="Primary account" />
                          )}
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Edit ${account.name}`}
                            onClick={(e) => { e.stopPropagation(); setAccountsOpen(true); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setAccountsOpen(true); } }}
                            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background/60 hover:text-foreground group-hover:opacity-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="truncate text-sm font-semibold">{account.name}</p>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{account.type}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {revealed ? (
                            <p className="text-xl font-bold tabular-nums">{formatAmount(balance, acctCur)}</p>
                          ) : (
                            <>
                              <p className="text-xl font-bold tracking-widest">••••</p>
                              <button
                                type="button"
                                aria-label="Reveal balance"
                                onClick={(e) => { e.stopPropagation(); setRevealedAccts((prev) => new Set(prev).add(account.id)); }}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAccountsOpen(true)}
                  className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-sm font-medium">Add card</span>
                </button>
              </div>
            )}
          </section>

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
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
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
                    <Heatmap year={year} month={month} byDay={byDay} todayKey={todayKey} renewals={renewalMarks} />
                  </Panel>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                <div>
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
                                    {formatDayLabel(e.date)} · {accountName(e.account)}
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
            </div>

            <div className="xl:col-span-2 xl:order-last">
              <Panel
                title="Transactions"
                bodyClassName="p-0"
                action={
                  <div className="flex items-center gap-1">
                    {duplicateGroups.length > 0 && (
                      <Button variant="ghost" size="sm" className="text-amber-600 dark:text-amber-400" onClick={() => setDuplicatesOpen(true)}>
                        <Tag className="h-3.5 w-3.5" /> {duplicateGroups.length} possible duplicate{duplicateGroups.length === 1 ? "" : "s"}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Clear
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={selectedIds.length === 0} onClick={requestClearSelected}>
                          Clear selected ({selectedIds.length})
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={requestClearView} className="text-destructive focus:text-destructive">
                          {rangeFilter === "month" ? `Clear all of ${monthLabel(year, month)}` : "Clear current view"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                }
              >
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
                      onChange={(event) => setQuickEntry((prev) => ({ ...prev, account: event.target.value }))}
                    >
                      {activeAccts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
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
                  {selectedIds.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                      <span className="font-medium">{selectedIds.length} selected</span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancel</Button>
                        <Button size="sm" variant="destructive" onClick={requestClearSelected}>
                          <Trash2 className="h-3.5 w-3.5" /> Clear selected
                        </Button>
                      </div>
                    </div>
                  )}
                  {viewMode === "table" ? (
                    <div className="max-h-[70vh] overflow-auto rounded-lg border">
                      <table className="w-full min-w-[1020px] table-fixed border-collapse text-sm">
                        <colgroup>
                          <col className="w-[40px]" />
                          <col className="w-[86px]" /><col className="w-[54px]" /><col className="w-[102px]" />
                          <col className="w-[180px]" /><col className="w-[220px]" /><col className="w-[116px]" />
                          <col className="w-[116px]" /><col className="w-[128px]" /><col className="w-[92px]" />
                        </colgroup>
                        <thead>
                          <tr className="text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-muted [&>th]:shadow-[inset_0_-1px_0_hsl(var(--border))]">
                            <th className="px-2 py-3">
                              <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-input align-middle" />
                            </th>
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
                              <tr key={`${r.dateKey}-${idx}`} className={cn("group border-b last:border-0", isWeekend && "bg-muted/20", isToday && "bg-primary/5", r.entry && selected.has(r.entry.id) && "bg-primary/10", "hover:bg-accent/40")}>
                                <td className="px-2 py-2 align-middle">
                                  {r.entry && (
                                    <input type="checkbox" aria-label="Select transaction" checked={selected.has(r.entry.id)} onChange={() => toggleRow(r.entry!.id)} className="h-4 w-4 rounded border-input align-middle" />
                                  )}
                                </td>
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
                            <td className="px-2 py-2.5" colSpan={6}>Total</td>
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
                                  {formatDayLabel(entry.date)} · {categoryLabel(entry.category)} · {accountName(entry.account)}
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
                            <span className="text-xs text-muted-foreground">green = saved · red = spent · ● renewal</span>
                          </div>
                          <div className="mt-4">
                            <Heatmap year={year} month={month} byDay={byDay} todayKey={todayKey} renewals={renewalMarks} />
                          </div>
                        </div>
                      )}
                      {upcomingRenewals.length > 0 && (
                        <div className="rounded-2xl border bg-background p-4">
                          <p className="flex items-center gap-1.5 text-sm font-semibold">
                            <Repeat className="h-4 w-4 text-sky-500" /> Upcoming renewals
                          </p>
                          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                            {upcomingRenewals.slice(0, 6).map(({ rule, date, days }) => {
                              const Icon = subscriptionIcon(rule);
                              const color = categoryColor(rule.category);
                              const soon = days <= 5;
                              return (
                                <li key={rule.id} className="flex items-center gap-2.5 rounded-xl border border-input px-3 py-2">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}22`, color }}>
                                    <Icon className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{rule.note || categoryLabel(rule.category)}</p>
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                      {rule.kind === "income" ? "+" : "−"}{formatDisplayAmount(rule.amount)}/{RECURRING_FREQUENCY_ABBREV[rule.frequency]}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className={cn("text-xs font-medium", soon ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{renewalText(days)}</p>
                                    <p className="text-[11px] text-muted-foreground">{formatDayLabel(recurringDateKey(date))}</p>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net worth</span>
                </div>
                <div className="space-y-3 p-4">
                  {netWorthByCurrency.map((g) => (
                    <div key={g.currency.code} className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span>{netWorthByCurrency.length > 1 ? `${g.currency.code} accounts` : "Total"}</span>
                      <span className="tabular-nums">{formatAmount(g.total, g.currency)}</span>
                    </div>
                  ))}
                  {netWorthByCurrency.length > 1 && (
                    <p className="text-[11px] text-muted-foreground">
                      Kept separate — no conversion between currencies.
                    </p>
                  )}
                  <div className="space-y-1.5 border-t pt-2">
                    {accountBalances.map(({ account, balance }) => (
                      <div key={account.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.color ?? "#64748b" }} />
                          <span className="truncate">{account.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatAmount(balance, account.currency ? resolveCurrency({ currency: account.currency }) : currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Repeat className="h-3.5 w-3.5" /> Recurring & subscriptions
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setRecurringOpen(true)}>Manage</Button>
                </div>
                <div className="p-4">
                  {activeRecurring.length === 0 ? (
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p>
                        Track salary, rent, streaming, gym &amp; SaaS in one place — with next-renewal
                        dates, renewal alerts, and your total monthly cost.
                      </p>
                      <Button variant="secondary" size="sm" onClick={() => setRecurringOpen(true)}>
                        <Plus className="h-4 w-4" /> Add recurring
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Overhead summary */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border bg-background/60 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Per month</p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums">{formatDisplayAmount(monthlyOverhead)}</p>
                        </div>
                        <div className="rounded-lg border bg-background/60 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Per year</p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums">{formatDisplayAmount(monthlyOverhead * 12)}</p>
                        </div>
                      </div>

                      {dueRecurring.length > 0 && (
                        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                          <span className="font-medium text-amber-600 dark:text-amber-400">{dueRecurring.length} due now</span>
                          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => postRules(dueRecurring)}>Post all</Button>
                        </div>
                      )}

                      <ul className="space-y-2.5">
                        {activeRecurring.map((r) => {
                          const Icon = subscriptionIcon(r);
                          const color = categoryColor(r.category);
                          const due = isDue(r, now);
                          const posted = isPostedForCurrentPeriod(r, now);
                          const nextR = nextRenewal(r, now);
                          const inDays = daysUntil(nextR, now);
                          const soon = !due && inDays <= 5;
                          return (
                            <li key={r.id} className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}22`, color }}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{r.note || categoryLabel(r.category)}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {r.kind === "income" ? "+" : "−"}{formatDisplayAmount(r.amount)}/{RECURRING_FREQUENCY_ABBREV[r.frequency]}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                {due ? (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400" onClick={() => postRules([r])}>
                                    Post now
                                  </Button>
                                ) : (
                                  <>
                                    <p className={cn("text-xs font-medium", soon ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                                      {renewalText(inDays)}
                                    </p>
                                    <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                                      {posted && <Check className="h-3 w-3 text-emerald-500" />}
                                      {formatDayLabel(recurringDateKey(nextR))}
                                    </p>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
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

              {categoryBudgets.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category budgets</span>
                    <Button variant="ghost" size="sm" onClick={() => setBudgetOpen(true)}>Edit</Button>
                  </div>
                  <div className="space-y-3 p-4">
                    {categoryBudgets.map(({ category, cap, spent }) => {
                      const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
                      const over = spent > cap;
                      const near = !over && pct >= 80;
                      const barCls = over ? "bg-rose-500" : near ? "bg-amber-500" : "bg-emerald-500";
                      return (
                        <div key={category}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(category) }} />
                              {categoryLabel(category)}
                            </span>
                            <span className={cn("tabular-nums", over ? "font-semibold text-rose-500" : "text-muted-foreground")}>
                              {formatDisplayAmount(spent)} / {formatDisplayAmount(cap)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", barCls)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
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
            accounts={activeAccts}
            expense={form.expense}
            onSaved={load}
          />
          <BudgetFormDialog open={budgetOpen} onOpenChange={setBudgetOpen} userId={user.uid} budget={budget} onSaved={load} />
          <TransferDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            userId={user.uid}
            defaultDate={isCurrentMonth ? todayKey : `${mKey}-01`}
            accounts={activeAccts}
            onSaved={load}
          />
          <AccountManagerDialog
            open={accountsOpen}
            onOpenChange={setAccountsOpen}
            userId={user.uid}
            accounts={accounts}
            expenses={expenses}
            currency={currency}
            onSaved={load}
          />
          <CashCounterDialog
            open={cashOpen}
            onOpenChange={setCashOpen}
            userId={user.uid}
            legend={budget?.cashLegend ?? []}
            accounts={accounts}
            expenses={expenses}
            currency={currency}
            onSaved={load}
          />
          <RecurringDialog
            open={recurringOpen}
            onOpenChange={setRecurringOpen}
            rules={recurring}
            onSave={saveRecurring}
          />
          <DuplicatesDialog
            open={duplicatesOpen}
            onOpenChange={setDuplicatesOpen}
            groups={duplicateGroups}
            format={formatDisplayAmount}
            accountName={accountName}
            onDelete={removeEntry}
          />
          <ConfirmDialog
            open={clearTarget !== null}
            onOpenChange={(o) => { if (!o) setClearTarget(null); }}
            title="Clear transactions?"
            description={`This permanently deletes ${clearTarget?.scope ?? ""}. This can't be undone.`}
            confirmLabel="Delete"
            destructive
            onConfirm={confirmClear}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational
// ---------------------------------------------------------------------------
function Donut({ data, currency, total, formatAmountDisplay }: { data: { category: string; amount: number }[]; currency: ReturnType<typeof resolveCurrency>; total: number; formatAmountDisplay: (amount: number) => string }) {
  if (total <= 0) {
    return <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">No expenses yet</div>;
  }
  const r = 62, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 170 170" className="h-52 w-52 shrink-0">
        {data.map((d) => {
          const len = (d.amount / total) * c;
          const el = (
            <circle key={d.category} cx={85} cy={85} r={r} fill="none" stroke={categoryColor(d.category)} strokeWidth={22}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 85 85)" />
          );
          offset += len;
          return el;
        })}
        <text x={85} y={80} textAnchor="middle" className="fill-muted-foreground text-[11px] uppercase tracking-wide">Total spent</text>
        <text x={85} y={100} textAnchor="middle" className="fill-foreground text-[19px] font-bold">{formatAmountDisplay(total)}</text>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-2.5 text-[15px]">
        {data.slice(0, 6).map((d) => {
          const Icon = iconFor(d.category);
          return (
            <li key={d.category} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${categoryColor(d.category)}22`, color: categoryColor(d.category) }}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{categoryLabel(d.category)}</span>
              <span className="shrink-0 tabular-nums">{formatAmountDisplay(d.amount)}</span>
              <span className="w-11 shrink-0 text-right tabular-nums text-sm text-muted-foreground">{Math.round((d.amount / total) * 100)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Heatmap({ year, month, byDay, todayKey, renewals }: {
  year: number; month: number; byDay: Map<string, { income: Expense[]; expense: Expense[]; net: number }>; todayKey: string;
  renewals?: Map<number, string[]>;
}) {
  const dim = daysInMonth(year, month);
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-first
  let maxAbs = 1;
  for (let d = 1; d <= dim; d++) {
    const b = byDay.get(`${monthKey(year, month)}-${String(d).padStart(2, "0")}`);
    if (b) maxAbs = Math.max(maxAbs, Math.abs(b.net));
  }
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const hasRenewals = renewals != null && renewals.size > 0;
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
          const dayRenewals = renewals?.get(day);
          const title =
            (n !== 0 ? `${formatDayLabel(key)}: ${n > 0 ? "+" : ""}${n}` : formatDayLabel(key)) +
            (dayRenewals ? ` · Renews: ${dayRenewals.join(", ")}` : "");
          return (
            <div
              key={key}
              title={title}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded text-[11px] tabular-nums",
                !bg && "bg-muted/40 text-muted-foreground",
                bg && "font-medium text-white",
                isToday && "ring-2 ring-primary"
              )}
              style={bg ? { backgroundColor: bg } : undefined}
            >
              {day}
              {dayRenewals && (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-sky-400 ring-1 ring-background" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Saved more</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Spent more</span>
        {hasRenewals && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Renewal</span>}
      </div>
    </div>
  );
}

