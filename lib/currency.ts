import type { Budget } from "@/lib/types";

export interface Currency {
  code: string;
  label: string;
  symbol: string;
  /** true → symbol goes after the amount ("120 L"), false → before ("$120"). */
  suffix: boolean;
}

export const CURRENCIES: Currency[] = [
  { code: "USD", label: "US Dollar", symbol: "$", suffix: false },
  { code: "EUR", label: "Euro", symbol: "€", suffix: false },
  { code: "GBP", label: "British Pound", symbol: "£", suffix: false },
  { code: "MDL", label: "Moldovan Leu", symbol: "L", suffix: true },
  { code: "RON", label: "Romanian Leu", symbol: "lei", suffix: true },
  { code: "UAH", label: "Ukrainian Hryvnia", symbol: "₴", suffix: false },
  { code: "PLN", label: "Polish Złoty", symbol: "zł", suffix: true },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF", suffix: true },
];

// Default to Moldovan Leu — this is a MDL-first setup for now.
const DEFAULT_CURRENCY =
  CURRENCIES.find((c) => c.code === "MDL") ?? CURRENCIES[0];

/**
 * Resolve the user's currency from the budget doc. `budget.currency` may hold
 * a currency code ("MDL"), or a legacy raw symbol ("$") from before the
 * selector existed — both resolve correctly.
 */
export function resolveCurrency(budget: Pick<Budget, "currency"> | null): Currency {
  const raw = budget?.currency?.trim();
  if (!raw) return DEFAULT_CURRENCY;
  const byCode = CURRENCIES.find((c) => c.code === raw.toUpperCase());
  if (byCode) return byCode;
  const bySymbol = CURRENCIES.find((c) => c.symbol === raw);
  if (bySymbol) return bySymbol;
  // Unknown custom symbol — keep displaying it as a prefix.
  return { code: raw, label: raw, symbol: raw, suffix: false };
}

/** Format an amount in the given currency; hides trailing .00. */
export function formatAmount(amount: number, cur: Currency): string {
  const rounded = Math.round(amount * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return cur.suffix ? `${str} ${cur.symbol}` : `${cur.symbol}${str}`;
}
