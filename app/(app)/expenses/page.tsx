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
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
  Scale,
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
  categoryColor,
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

  const monthExpenses = useMemo(
    () =>
      expenses.filter(
        (e) =>
          inMonth(e.date, mKey) && (filter === "all" || e.account === filter)
      ),
    [expenses, mKey, filter]
  );

  const earned = useMemo(() => totalEarned(monthExpenses), [monthExpenses]);
  const spent = useMemo(() => totalSpent(monthExpenses), [monthExpenses]);
  const net = useMemo(() => netTotal(monthExpenses), [monthExpenses]);

  // Entries per calendar day, oldest first within the day.
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

  const accounts = useMemo(
    () =>
      ACCOUNTS.map((a) => ({
        key: a,
        balance: accountBalance(expenses, a, budget?.openingBalances?.[a] ?? 0),
      })),
    [expenses, budget]
  );
  const openingTotal = useMemo(
    () =>
      ACCOUNTS.reduce((s, a) => s + (budget?.openingBalances?.[a] ?? 0), 0),
    [budget]
  );
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);

  const dim = daysInMonth(year, month);

  // End-of-day net worth across every day of the month (like a bank statement),
  // seeded by everything before this month plus opening balances.
  const dayBalances = useMemo(() => {
    let base = openingTotal;
    const firstOfMonth = `${mKey}-01`;
    for (const e of expenses) {
      if (e.date < firstOfMonth) base += e.kind === "income" ? e.amount : -e.amount;
    }
    const map: Record<string, number> = {};
    let running = base;
    for (let d = 1; d <= dim; d++) {
      const key = `${mKey}-${String(d).padStart(2, "0")}`;
      const b = byDay.get(key);
      if (b) {
        for (const e of b.income) running += e.amount;
        for (const e of b.expense) running -= e.amount;
      }
      map[key] = Math.round(running * 100) / 100;
    }
    return map;
  }, [expenses, byDay, openingTotal, mKey, dim]);

  // --- Stats -----------------------------------------------------------------
  const stats = useMemo(() => {
    const daysLogged = new Set(monthExpenses.map((e) => e.date)).size;
    const expenseEntries = monthExpenses.filter((e) => e.kind === "expense");
    const biggest = expenseEntries.reduce<Expense | null>(
      (max, e) => (!max || e.amount > max.amount ? e : max),
      null
    );
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const activeDays = isCurrentMonth ? now.getDate() : dim;
    const avgPerDay = activeDays > 0 ? spent / activeDays : 0;
    return { daysLogged, biggest, avgPerDay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthExpenses, spent, dim, year, month]);

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

  async function commitNote(entry: Expense | undefined, text: string) {
    if (!entry) return;
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

  async function commitCategory(entry: Expense | undefined, category: string) {
    if (!entry || category === entry.category) return;
    setExpenses((prev) =>
      prev.map((x) => (x.id === entry.id ? { ...x, category } : x))
    );
    try {
      await updateExpense(entry.id, { category });
    } catch {
      await load({ quiet: true });
    }
  }

  async function deleteRow(rowEntries: Expense[]) {
    if (rowEntries.length === 0) return;
    const ids = new Set(rowEntries.map((e) => e.id));
    setExpenses((prev) => prev.filter((x) => !ids.has(x.id)));
    try {
      await Promise.all([...ids].map((id) => deleteExpense(id)));
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

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const budgetCap = budget?.monthlyTotal ?? null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Finance</h1>
          <p className="text-muted-foreground">
            Type earned and spent straight into the grid — totals, balances and
            running worth update themselves.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Earned" value={formatAmount(earned, currency)} tone="up" icon={TrendingUp} />
        <StatCard label="Spent" value={formatAmount(spent, currency)} tone="down" icon={TrendingDown} />
        <StatCard
          label="Net"
          value={formatAmount(net, currency)}
          tone={net >= 0 ? "up" : "down"}
          icon={Scale}
        />
        <StatCard
          label="Net worth"
          value={formatAmount(netWorth, currency)}
          tone="neutral"
          icon={Wallet}
          hint={accounts
            .map((a) => `${ACCOUNT_LABEL[a.key]} ${formatAmount(a.balance, currency)}`)
            .join(" · ")}
        />
        <StatCard
          label="Avg / day"
          value={formatAmount(stats.avgPerDay, currency)}
          tone="neutral"
          icon={CalendarCheck}
          hint={`${stats.daysLogged} day${stats.daysLogged === 1 ? "" : "s"} logged${
            budgetCap != null
              ? ` · budget ${formatAmount(spent, currency)}/${formatAmount(budgetCap, currency)}`
              : ""
          }`}
        />
      </div>

      {loading ? (
        <SkeletonCard lines={10} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-[15px]">
            <colgroup>
              <col className="w-[132px]" />
              <col className="w-[112px]" />
              <col className="w-[136px]" />
              <col />
              <col className="w-[112px]" />
              <col className="w-[136px]" />
              <col />
              <col className="w-[128px]" />
              <col className="w-[44px]" />
            </colgroup>
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide">
                <th className="px-3 py-2.5 text-muted-foreground">Date</th>
                <th className="bg-emerald-500/5 px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                  Earned
                </th>
                <th className="bg-emerald-500/5 px-3 py-2.5 text-emerald-600 dark:text-emerald-400">
                  Category
                </th>
                <th className="bg-emerald-500/5 px-3 py-2.5 text-emerald-600 dark:text-emerald-400">
                  For…
                </th>
                <th className="border-l bg-rose-500/5 px-3 py-2.5 text-right text-rose-600 dark:text-rose-400">
                  Spent
                </th>
                <th className="bg-rose-500/5 px-3 py-2.5 text-rose-600 dark:text-rose-400">
                  Category
                </th>
                <th className="bg-rose-500/5 px-3 py-2.5 text-rose-600 dark:text-rose-400">
                  For…
                </th>
                <th className="border-l px-3 py-2.5 text-right text-muted-foreground">
                  Balance
                </th>
                <th className="px-1 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dateKey = `${mKey}-${String(day).padStart(2, "0")}`;
                const bucket = byDay.get(dateKey) ?? { income: [], expense: [] };
                const extra = extraRows[dateKey] ?? 0;
                const lineCount = Math.max(
                  1,
                  bucket.income.length,
                  bucket.expense.length
                );
                const rows = lineCount + extra;
                const weekday = WEEKDAYS_SHORT[new Date(year, month, day).getDay()];
                const isToday = dateKey === todayKey;
                const isWeekend = weekday === "Sat" || weekday === "Sun";

                return Array.from({ length: rows }, (_, i) => {
                  const inc = bucket.income[i];
                  const exp = bucket.expense[i];
                  const first = i === 0;
                  const rowEntries = [inc, exp].filter(Boolean) as Expense[];
                  return (
                    <tr
                      key={`${dateKey}-${i}`}
                      className={cn(
                        "group border-b last:border-0",
                        isWeekend && "bg-muted/20",
                        isToday && "bg-primary/5",
                        "hover:bg-accent/40"
                      )}
                    >
                      <td className="px-3 py-1.5 align-middle">
                        {first && (
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums font-semibold">
                              {day} {MONTHS_SHORT[month]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {weekday}
                            </span>
                            <button
                              onClick={() => addLine(dateKey)}
                              aria-label={`Add another entry on ${day} ${MONTHS_SHORT[month]}`}
                              className="ml-auto rounded p-0.5 text-muted-foreground/50 opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Income side */}
                      <AmountCell
                        entry={inc}
                        tone="income"
                        onCommit={(num) => commitAmount(dateKey, "income", inc, num)}
                      />
                      <CategoryCell
                        entry={inc}
                        kind="income"
                        onCommit={(c) => commitCategory(inc, c)}
                      />
                      <NoteCell entry={inc} onCommit={(t) => commitNote(inc, t)} />

                      {/* Expense side */}
                      <AmountCell
                        entry={exp}
                        tone="expense"
                        bordered
                        onCommit={(num) => commitAmount(dateKey, "expense", exp, num)}
                      />
                      <CategoryCell
                        entry={exp}
                        kind="expense"
                        onCommit={(c) => commitCategory(exp, c)}
                      />
                      <NoteCell entry={exp} onCommit={(t) => commitNote(exp, t)} />

                      {/* Balance */}
                      <td
                        className={cn(
                          "border-l px-3 py-1.5 text-right tabular-nums",
                          first ? "text-foreground" : "text-transparent",
                          first && dayBalances[dateKey] < 0 && "text-destructive"
                        )}
                      >
                        {first ? formatAmount(dayBalances[dateKey] ?? 0, currency) : ""}
                      </td>

                      {/* Delete */}
                      <td className="px-1 py-1.5 text-center">
                        {rowEntries.length > 0 && (
                          <button
                            onClick={() => deleteRow(rowEntries)}
                            aria-label="Delete this row"
                            className="rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40 text-[15px] font-semibold">
                <td className="px-3 py-3">Total</td>
                <td className="bg-emerald-500/5 px-3 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatAmount(earned, currency)}
                </td>
                <td className="bg-emerald-500/5" colSpan={2} />
                <td className="border-l bg-rose-500/5 px-3 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                  {formatAmount(spent, currency)}
                </td>
                <td className="bg-rose-500/5" colSpan={2} />
                <td
                  className={cn(
                    "border-l px-3 py-3 text-right tabular-nums",
                    net >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                  title="Net this month"
                >
                  {net >= 0 ? "+" : ""}
                  {formatAmount(net, currency)}
                </td>
                <td />
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
// Stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "up" && "text-emerald-600 dark:text-emerald-400",
          tone === "down" && "text-destructive"
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Editable cells
// ---------------------------------------------------------------------------
function AmountCell({
  entry,
  tone,
  bordered,
  onCommit,
}: {
  entry: Expense | undefined;
  tone: "income" | "expense";
  bordered?: boolean;
  onCommit: (num: number | null) => void;
}) {
  const value = entry?.amount ?? null;
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
    <td
      className={cn(
        "px-1 py-1 text-right",
        tone === "income" ? "bg-emerald-500/[0.03]" : "bg-rose-500/[0.03]",
        bordered && "border-l"
      )}
    >
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
          "w-full rounded bg-transparent px-2 py-1.5 text-right tabular-nums outline-none transition-colors placeholder:text-muted-foreground/30 hover:bg-background/60 focus:bg-background focus:ring-1 focus:ring-primary",
          value != null &&
            (tone === "income"
              ? "font-semibold text-emerald-600 dark:text-emerald-400"
              : "font-semibold text-rose-600 dark:text-rose-400")
        )}
      />
    </td>
  );
}

function CategoryCell({
  entry,
  kind,
  onCommit,
}: {
  entry: Expense | undefined;
  kind: EntryKind;
  onCommit: (category: string) => void;
}) {
  const cells = kind === "income" ? "bg-emerald-500/[0.03]" : "bg-rose-500/[0.03]";
  if (!entry) return <td className={cn("px-1 py-1", cells)} />;
  const cats = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const label = (c: string) =>
    kind === "income"
      ? INCOME_CATEGORY_LABEL[c as keyof typeof INCOME_CATEGORY_LABEL] ?? c
      : EXPENSE_CATEGORY_LABEL[c as keyof typeof EXPENSE_CATEGORY_LABEL] ?? c;

  return (
    <td className={cn("px-1 py-1", cells)}>
      <Select value={entry.category} onValueChange={onCommit}>
        <SelectTrigger className="h-8 border-transparent bg-transparent px-2 hover:bg-background/60">
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
    </td>
  );
}

function NoteCell({
  entry,
  onCommit,
}: {
  entry: Expense | undefined;
  onCommit: (text: string) => void;
}) {
  const value = entry?.note ?? "";
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  if (!entry) return <td className="px-1 py-1" />;

  return (
    <td className="px-1 py-1">
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
        className="w-full rounded bg-transparent px-2 py-1.5 outline-none transition-colors placeholder:text-muted-foreground/30 hover:bg-background/60 focus:bg-background focus:ring-1 focus:ring-primary"
      />
    </td>
  );
}
