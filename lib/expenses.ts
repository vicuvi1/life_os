import type {
  Account,
  AccountKey,
  Budget,
  CashDenom,
  Expense,
  ExpenseCategory,
  IncomeCategory,
} from "@/lib/types";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "food",
  "transport",
  "fitness",
  "entertainment",
  "education",
  "health",
  "other",
];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: "Food",
  transport: "Transport",
  fitness: "Fitness",
  entertainment: "Entertainment",
  education: "Education",
  health: "Health",
  other: "Other",
};

export const EXPENSE_CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  food: "#f59e0b",
  transport: "#3b82f6",
  fitness: "#ef4444",
  entertainment: "#8b5cf6",
  education: "#10b981",
  health: "#ec4899",
  other: "#64748b",
};

export const INCOME_CATEGORIES: IncomeCategory[] = [
  "salary",
  "allowance",
  "gift",
  "sale",
  "refund",
  "investment",
  "other",
];

export const INCOME_CATEGORY_LABEL: Record<IncomeCategory, string> = {
  salary: "Salary",
  allowance: "Allowance",
  gift: "Gift",
  sale: "Sale",
  refund: "Refund",
  investment: "Investment",
  other: "Other",
};

export const INCOME_CATEGORY_COLOR: Record<IncomeCategory, string> = {
  salary: "#10b981",
  allowance: "#22c55e",
  gift: "#14b8a6",
  sale: "#0ea5e9",
  refund: "#84cc16",
  investment: "#6366f1",
  other: "#64748b",
};

export const ACCOUNTS: AccountKey[] = ["wallet", "safe"];

export const ACCOUNT_LABEL: Record<AccountKey, string> = {
  wallet: "Wallet",
  safe: "Safe",
};

/**
 * Category key used for internal money movements between accounts (Wallet↔Safe).
 * A transfer is stored as a paired expense (out of the source) + income (into the
 * destination) so account balances update correctly, but it is neither real income
 * nor real spending — so income/expense totals and the category breakdown skip it.
 */
export const TRANSFER_CATEGORY = "transfer";

/** Whether an entry is an internal Wallet↔Safe transfer (not real income/spend). */
export function isTransfer(e: Pick<Expense, "category">): boolean {
  return e.category === TRANSFER_CATEGORY;
}

/** Label for any category key (expense, income, or a custom tag). */
export function categoryLabel(cat: string): string {
  const maps: Record<string, string> = {
    ...EXPENSE_CATEGORY_LABEL,
    ...INCOME_CATEGORY_LABEL,
  };
  if (maps[cat]) return maps[cat];
  return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : "Other";
}

/** Color for any category key; falls back to a neutral grey. */
export function categoryColor(cat: string): string {
  if (cat === TRANSFER_CATEGORY) return "#0ea5e9"; // sky — internal movement
  const maps: Record<string, string> = {
    ...EXPENSE_CATEGORY_COLOR,
    ...INCOME_CATEGORY_COLOR,
  };
  return maps[cat] ?? "#64748b";
}

/** Format an amount with the user's currency symbol; hide trailing .00. */
export function formatMoney(amount: number, currency = "$"): string {
  const rounded = Math.round(amount * 100) / 100;
  const str = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2);
  return `${currency}${str}`;
}

// --- Month helpers -----------------------------------------------------------

/** "YYYY-MM" for a given year and 0-based month. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Whether a YYYY-MM-DD date falls in the given YYYY-MM month. */
export function inMonth(dateKey: string, mKey: string): boolean {
  return dateKey.startsWith(mKey);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function monthLabel(year: number, month: number): string {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[month]} ${year}`;
}

// --- Aggregation -------------------------------------------------------------

/** Round to whole cents to avoid float drift (e.g. 0.1 + 0.2). */
function toCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Total of the expense entries only (money out); excludes internal transfers. */
export function totalSpent(entries: Expense[]): number {
  return toCents(
    entries
      .filter((e) => e.kind === "expense" && !isTransfer(e))
      .reduce((s, e) => s + e.amount, 0)
  );
}

/** Total of the income entries only (money in); excludes internal transfers. */
export function totalEarned(entries: Expense[]): number {
  return toCents(
    entries
      .filter((e) => e.kind === "income" && !isTransfer(e))
      .reduce((s, e) => s + e.amount, 0)
  );
}

/** Net for a set of entries: earned − spent (may be negative). */
export function netTotal(entries: Expense[]): number {
  return toCents(totalEarned(entries) - totalSpent(entries));
}

export interface CategorySpend {
  category: string;
  amount: number;
}

/** Spend grouped by category — expense entries only. */
export function spendByCategory(entries: Expense[]): CategorySpend[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== "expense" || isTransfer(e)) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount: toCents(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Current balance of an account: its opening balance plus all income minus all
 * expenses recorded against it. Pass ALL entries (not just one month).
 */
export function accountBalance(
  entries: Expense[],
  account: string,
  opening = 0
): number {
  let bal = opening;
  for (const e of entries) {
    if (e.account !== account) continue;
    bal += e.kind === "income" ? e.amount : -e.amount;
  }
  return toCents(bal);
}

// ---------------------------------------------------------------------------
// Accounts (user-defined cards / wallets) + cash counter legend.
// ---------------------------------------------------------------------------
export const ACCOUNT_TYPE_SUGGESTIONS = [
  "Cash",
  "Debit",
  "Credit",
  "Savings",
  "Checking",
  "Crypto wallet",
  "Investment",
  "Business",
  "Other",
];
export const ACCOUNT_COLORS = [
  "#8b5cf6",
  "#7c3aed",
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#06b6d4",
  "#14b8a6",
  "#10b981",
  "#22c55e",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#d946ef",
  "#a855f7",
  "#64748b",
  "#475569",
  "#0f172a",
];
export const ACCOUNT_ICONS = [
  "💵", "💳", "🏦", "👛", "🪙", "💰", "📈", "📊",
  "🔒", "🐷", "🏆", "🎯", "💎", "🧾", "🏠", "🚗",
  "✈️", "🎓", "🛒", "₿", "💼", "🎁",
];

function uid(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

/** Seed the two legacy accounts from the old opening balances (one-time). */
export function seedAccounts(budget: Pick<Budget, "openingBalances"> | null): Account[] {
  const ob = budget?.openingBalances ?? {};
  return [
    { id: "wallet", name: "Wallet", description: null, color: "#8b5cf6", icon: "💵", image: null, type: "Cash", startingBalance: ob.wallet ?? 0, currency: null, isPrimary: true, hideBalance: false, archived: false, order: 0, createdAt: 0 },
    { id: "safe", name: "Safe", description: null, color: "#10b981", icon: "🐷", image: null, type: "Savings", startingBalance: ob.safe ?? 0, currency: null, isPrimary: false, hideBalance: false, archived: false, order: 1, createdAt: 0 },
  ];
}

export function makeAccount(order: number): Account {
  return {
    id: uid("acc"),
    name: "",
    description: null,
    color: ACCOUNT_COLORS[order % ACCOUNT_COLORS.length],
    icon: null,
    image: null,
    type: "Cash",
    startingBalance: 0,
    currency: null,
    isPrimary: false,
    hideBalance: false,
    archived: false,
    order,
    createdAt: Date.now(),
  };
}

/** Fill in any missing fields on an account read from storage. */
export function normalizeAccount(raw: Partial<Account> & { id: string }): Account {
  return {
    id: raw.id,
    name: raw.name ?? "Account",
    description: raw.description ?? null,
    color: raw.color ?? null,
    icon: raw.icon ?? null,
    image: raw.image ?? null,
    type: raw.type ?? "Other",
    startingBalance: typeof raw.startingBalance === "number" ? raw.startingBalance : 0,
    currency: raw.currency ?? null,
    isPrimary: raw.isPrimary === true,
    hideBalance: raw.hideBalance === true,
    archived: raw.archived === true,
    order: typeof raw.order === "number" ? raw.order : 0,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
  };
}

export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.order - b.order);
}
export function activeAccounts(accounts: Account[]): Account[] {
  return sortAccounts(accounts.filter((a) => !a.archived));
}
export function accountById(accounts: Account[]): Map<string, Account> {
  return new Map(accounts.map((a) => [a.id, a]));
}

/** Live balance of an account: starting balance + income − expenses on it. */
export function computeAccountBalance(
  account: Pick<Account, "id" | "startingBalance">,
  entries: Expense[]
): number {
  let bal = account.startingBalance;
  for (const e of entries) {
    if (e.account !== account.id) continue;
    bal += e.kind === "income" ? e.amount : -e.amount;
  }
  return toCents(bal);
}

/** Starting balance needed so the live balance equals `target` given `entries`. */
export function startingBalanceForTarget(
  account: Pick<Account, "id" | "startingBalance">,
  entries: Expense[],
  target: number
): number {
  const net = computeAccountBalance({ id: account.id, startingBalance: 0 }, entries);
  return toCents(target - net);
}

/** Whether an account still has any linked transactions (→ archive, not delete). */
export function accountHasHistory(accountId: string, entries: Expense[]): boolean {
  return entries.some((e) => e.account === accountId);
}

// --- Cash counter legend ---
export function defaultCashLegend(): CashDenom[] {
  return [
    { id: uid("cd"), color: "#eab308", label: "Yellow", value: 1000, order: 0 },
    { id: uid("cd"), color: "#3b82f6", label: "Blue", value: 2000, order: 1 },
    { id: uid("cd"), color: "#ef4444", label: "Red", value: 5000, order: 2 },
    { id: uid("cd"), color: "#22c55e", label: "Green", value: 10000, order: 3 },
  ];
}
export function makeDenom(order: number): CashDenom {
  return {
    id: uid("cd"),
    color: ACCOUNT_COLORS[order % ACCOUNT_COLORS.length],
    label: "",
    value: 0,
    order,
  };
}
export function sortDenoms(legend: CashDenom[]): CashDenom[] {
  return [...legend].sort((a, b) => a.order - b.order);
}
/** Running total = Σ(count × value). */
export function cashTotal(legend: CashDenom[], counts: Record<string, number>): number {
  return toCents(legend.reduce((s, d) => s + (counts[d.id] ?? 0) * d.value, 0));
}

export interface EntryWithBalance extends Expense {
  /** Cumulative net after this entry, in chronological order. */
  balance: number;
}

/**
 * Annotate each entry with a cumulative net balance computed in chronological
 * order (oldest → newest), starting from `opening`. The balance stays attached
 * to the entry regardless of how the caller later sorts the list for display.
 */
export function withRunningBalance(
  entries: Expense[],
  opening = 0
): EntryWithBalance[] {
  const chrono = [...entries].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt
  );
  let bal = opening;
  const byId = new Map<string, number>();
  for (const e of chrono) {
    bal += e.kind === "income" ? e.amount : -e.amount;
    byId.set(e.id, toCents(bal));
  }
  return entries.map((e) => ({ ...e, balance: byId.get(e.id) ?? 0 }));
}

export interface MonthStatus {
  spent: number;
  budget: number | null;
  remaining: number | null; // budget - spent (may be negative)
  pctUsed: number | null; // 0-100+, null if no budget
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  projected: number; // pace-based projection for the full month
  overBudget: boolean;
}

/**
 * Budget status for a month. For the CURRENT month, projection uses the pace so
 * far; for a completed/past month, projection is just the actual spend.
 */
export function monthStatus(
  expenses: Expense[],
  budget: number | null,
  opts: { year: number; month: number; today: Date }
): MonthStatus {
  const spent = totalSpent(expenses);
  const dim = daysInMonth(opts.year, opts.month);

  const isCurrentMonth =
    opts.today.getFullYear() === opts.year &&
    opts.today.getMonth() === opts.month;
  const isPastMonth =
    opts.year < opts.today.getFullYear() ||
    (opts.year === opts.today.getFullYear() &&
      opts.month < opts.today.getMonth());

  const daysElapsed = isCurrentMonth ? opts.today.getDate() : isPastMonth ? dim : 0;
  const daysRemaining = Math.max(0, dim - daysElapsed);

  const projected =
    isCurrentMonth && daysElapsed > 0 ? (spent / daysElapsed) * dim : spent;

  const remaining = budget != null ? budget - spent : null;
  const pctUsed = budget != null && budget > 0 ? (spent / budget) * 100 : null;
  const overBudget = budget != null && spent > budget;

  return {
    spent,
    budget,
    remaining,
    pctUsed,
    daysElapsed,
    daysInMonth: dim,
    daysRemaining,
    projected,
    overBudget,
  };
}
