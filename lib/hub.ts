// Agent Hub core: module metadata, default agents, live context injection for
// agent chats, and the automation metrics/rule evaluation engine. Everything is
// computed from real Firestore data passed in by the pages — no static answers.

import type {
  Budget,
  ClothingItem,
  Expense,
  HubAgent,
  HubAutomation,
  HubModule,
  Outfit,
  SleepLog,
  Task,
  WearLog,
} from "@/lib/types";
import { statusCounts, neverWorn, costPerWear } from "@/lib/wardrobe";
import { averageOverDays, sleepDebt, sleepGoalStreak, formatHours } from "@/lib/sleep";

export interface HubWeather {
  temp: number;
  code: number;
  label: string;
  rainTomorrow: boolean;
  tomorrowMax: number | null;
}

/** Everything the hub reads across modules (loaded once per page visit). */
export interface HubData {
  today: string;
  items: ClothingItem[];
  outfits: Outfit[];
  wears: WearLog[];
  expenses: Expense[];
  budget: Budget | null;
  sleep: SleepLog[]; // main nights only
  sleepTarget: number;
  tasks: Task[];
  weather: HubWeather | null;
}

export const HUB_MODULES: Record<HubModule, { label: string; icon: string; href: string }> = {
  wardrobe: { label: "Wardrobe", icon: "🧥", href: "/wardrobe" },
  finance: { label: "Finance", icon: "💰", href: "/expenses" },
  sleep: { label: "Sleep", icon: "🌙", href: "/sleep" },
  tasks: { label: "Tasks", icon: "✅", href: "/tasks" },
  general: { label: "All modules", icon: "🧠", href: "/dashboard" },
};

export const BASE_PROMPT = `You are the {{name}} in Life OS, Victor's personal life dashboard.
Be concise, concrete, and honest. Answer ONLY from the live data below — if the
data doesn't contain the answer, say so instead of guessing. Prefer bullet
points; suggest one clear next action when relevant.

=== LIVE DATA ===
{{context}}`;

/** Built-in agents that work with zero setup; saving/editing writes real docs. */
export function defaultAgents(userId: string): HubAgent[] {
  const mk = (id: string, name: string, icon: string, module: HubModule): HubAgent => ({
    id,
    userId,
    name,
    icon,
    module,
    provider: "anthropic",
    model: "",
    systemPrompt: BASE_PROMPT,
    createdAt: 0,
  });
  return [
    mk("default-wardrobe", "Wardrobe Agent", "🧥", "wardrobe"),
    mk("default-finance", "Finance Agent", "💰", "finance"),
    mk("default-sleep", "Sleep Agent", "🌙", "sleep"),
    mk("default-tasks", "Tasks Agent", "✅", "tasks"),
  ];
}

export function renderPrompt(agent: HubAgent, data: HubData): string {
  const context = buildContext(agent.module, data);
  return agent.systemPrompt.replaceAll("{{name}}", agent.name).replaceAll("{{context}}", context);
}

// ---------------------------------------------------------------------------
// Context injection — compact, live summaries per module
// ---------------------------------------------------------------------------
export function buildContext(module: HubModule, data: HubData): string {
  const parts: string[] = [`Today: ${data.today}`];
  if (data.weather) {
    parts.push(
      `Weather: ${data.weather.temp}°C, ${data.weather.label}${data.weather.tomorrowMax != null ? `; tomorrow max ${data.weather.tomorrowMax}°C${data.weather.rainTomorrow ? ", rain expected" : ""}` : ""}`
    );
  }
  if (module === "wardrobe" || module === "general") parts.push(wardrobeContext(data));
  if (module === "finance" || module === "general") parts.push(financeContext(data));
  if (module === "sleep" || module === "general") parts.push(sleepContext(data));
  if (module === "tasks" || module === "general") parts.push(tasksContext(data));
  return parts.filter(Boolean).join("\n\n");
}

function wardrobeContext(d: HubData): string {
  const active = d.items.filter((i) => !i.retired);
  const c = statusCounts(d.items);
  const wearable = active
    .filter((i) => ["clean", "ready", "worn"].includes(i.status))
    .slice(0, 40)
    .map((i) => `- ${i.name} (${i.category ?? "?"}, ${i.status}${i.color ? `, ${i.color}` : ""}, worn ${i.timesWorn}×${costPerWear(i) != null ? `, ${costPerWear(i)}/wear` : ""})`);
  const todayWear = d.wears.find((w) => w.date === d.today);
  const outfits = d.outfits.slice(0, 15).map((o) => `- ${o.name}${o.occasions.length ? ` [${o.occasions.join(", ")}]` : ""} (worn ${o.timesWorn}×)`);
  return [
    `WARDROBE: ${active.length} items — clean ${c.clean}, worn ${c.worn}, dirty ${c.dirty}, washing ${c.washing}, drying ${c.drying}, ready ${c.ready}, needs ironing ${c.needsIroning}, never worn ${neverWorn(d.items).length}.`,
    `Today's outfit: ${todayWear ? `${todayWear.planned ? "planned" : "worn"} (${todayWear.itemIds.length} items)` : "not picked yet"}.`,
    wearable.length ? `Wearable now:\n${wearable.join("\n")}` : "Nothing wearable right now.",
    outfits.length ? `Saved outfits:\n${outfits.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

function financeContext(d: HubData): string {
  const ym = d.today.slice(0, 7);
  const month = d.expenses.filter((e) => e.date.startsWith(ym));
  const spent = month.filter((e) => e.kind !== "income").reduce((s, e) => s + e.amount, 0);
  const income = month.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0);
  const byCat = new Map<string, number>();
  for (const e of month) if (e.kind !== "income") byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const cats = Array.from(byCat, ([k, v]) => `- ${k}: ${Math.round(v)}`).sort().join("\n");
  const cap = d.budget?.monthlyTotal ?? null;
  return [
    `FINANCE (this month, ${d.budget?.currency ?? "MDL"}): spent ${Math.round(spent)}, income ${Math.round(income)}${cap ? `, budget ${cap} (${Math.round((spent / cap) * 100)}% used)` : ", no monthly budget set"}.`,
    cats ? `Spend by category:\n${cats}` : "No expenses logged this month.",
  ].join("\n");
}

function sleepContext(d: HubData): string {
  const last = d.sleep[0] ?? null;
  const avg7 = averageOverDays(d.sleep, d.today, 7);
  const debt = sleepDebt(d.sleep, d.sleepTarget, d.today, 7);
  const streak = sleepGoalStreak(d.sleep, d.sleepTarget, d.today);
  return [
    `SLEEP (goal ${d.sleepTarget}h): last night ${last ? `${formatHours(last.hours)} on ${last.date}${last.bedtime ? ` (${last.bedtime}–${last.wakeTime})` : ""}, quality ${last.quality}/10` : "not logged"}.`,
    `7-day avg ${avg7 ? formatHours(avg7) : "—"}; net 7-day ${debt >= 0 ? "surplus" : "debt"} ${formatHours(Math.abs(debt))}; goal streak ${streak} nights.`,
  ].join("\n");
}

function tasksContext(d: HubData): string {
  const open = d.tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < d.today);
  const dueToday = open.filter((t) => t.dueDate === d.today);
  const list = [...overdue, ...dueToday, ...open.filter((t) => !t.dueDate || t.dueDate > d.today)]
    .slice(0, 25)
    .map((t) => `- [${t.priority}] ${t.title}${t.dueDate ? ` (due ${t.dueDate}${t.dueDate < d.today ? " — OVERDUE" : ""})` : ""}`);
  return [`TASKS: ${open.length} open, ${overdue.length} overdue, ${dueToday.length} due today.`, list.join("\n")].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Automation metrics + evaluation
// ---------------------------------------------------------------------------
export interface MetricDef {
  key: string;
  label: string;
  module: HubModule;
  /** true → shown as a yes/no toggle (value 1). */
  boolean?: boolean;
  compute: (d: HubData) => number | null; // null = data unavailable (rule skipped)
}

export const HUB_METRICS: MetricDef[] = [
  { key: "dirtyCount", label: "Dirty items", module: "wardrobe", compute: (d) => statusCounts(d.items).dirty },
  { key: "laundryCount", label: "Items in wash cycle", module: "wardrobe", compute: (d) => { const c = statusCounts(d.items); return c.dirty + c.washing + c.drying; } },
  { key: "ironingCount", label: "Items needing ironing", module: "wardrobe", compute: (d) => statusCounts(d.items).needsIroning },
  { key: "noOutfitToday", label: "No outfit picked today", module: "wardrobe", boolean: true, compute: (d) => (d.wears.some((w) => w.date === d.today) ? 0 : 1) },
  { key: "budgetPct", label: "Budget used (%)", module: "finance", compute: (d) => { const cap = d.budget?.monthlyTotal; if (!cap) return null; const ym = d.today.slice(0, 7); const spent = d.expenses.filter((e) => e.date.startsWith(ym) && e.kind !== "income").reduce((s, e) => s + e.amount, 0); return Math.round((spent / cap) * 100); } },
  { key: "sleepDebt", label: "Sleep debt, 7d (hours)", module: "sleep", compute: (d) => { const debt = sleepDebt(d.sleep, d.sleepTarget, d.today, 7); return debt < 0 ? Math.abs(debt) : 0; } },
  { key: "lastNightHours", label: "Last night's sleep (hours)", module: "sleep", compute: (d) => { const l = d.sleep.find((s) => s.date === d.today) ?? d.sleep[0]; return l ? l.hours : null; } },
  { key: "sleepNotLogged", label: "Sleep not logged today", module: "sleep", boolean: true, compute: (d) => (d.sleep.some((s) => s.date === d.today) ? 0 : 1) },
  { key: "overdueTasks", label: "Overdue tasks", module: "tasks", compute: (d) => d.tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < d.today).length },
  { key: "dueTodayTasks", label: "Tasks due today", module: "tasks", compute: (d) => d.tasks.filter((t) => t.status !== "done" && t.dueDate === d.today).length },
  { key: "rainTomorrow", label: "Rain expected tomorrow", module: "general", boolean: true, compute: (d) => (d.weather ? (d.weather.rainTomorrow ? 1 : 0) : null) },
];

export const HUB_OPERATORS = [">=", "<=", ">", "<", "=="] as const;

export function metricDef(key: string): MetricDef | undefined {
  return HUB_METRICS.find((m) => m.key === key);
}

/** Evaluate one rule against live data. Null = metric unavailable. */
export function evaluateRule(rule: HubAutomation, data: HubData): { active: boolean; current: number } | null {
  const def = metricDef(rule.metric);
  if (!def) return null;
  const current = def.compute(data);
  if (current == null) return null;
  const v = rule.value;
  const active =
    rule.operator === ">=" ? current >= v
    : rule.operator === "<=" ? current <= v
    : rule.operator === ">" ? current > v
    : rule.operator === "<" ? current < v
    : current === v;
  return { active, current };
}

/** Fill {{value}} / {{metric}} into a rule's message. */
export function renderRuleMessage(rule: HubAutomation, current: number): string {
  const def = metricDef(rule.metric);
  return (rule.message || `${def?.label ?? rule.metric}: {{value}}`)
    .replaceAll("{{value}}", String(current))
    .replaceAll("{{metric}}", def?.label ?? rule.metric);
}

/** Starter rules offered when the list is empty (created only when the user taps). */
export function starterAutomations(): Array<Pick<HubAutomation, "name" | "metric" | "operator" | "value" | "action" | "telegram" | "message">> {
  return [
    { name: "Laundry time", metric: "dirtyCount", operator: ">=", value: 5, action: "notify", telegram: true, message: "🧺 {{value}} items are dirty — time for laundry." },
    { name: "Budget warning", metric: "budgetPct", operator: ">=", value: 85, action: "notify", telegram: true, message: "💰 Budget at {{value}}% this month — slow down." },
    { name: "Sleep debt building", metric: "sleepDebt", operator: ">=", value: 3, action: "notify", telegram: false, message: "😴 You're {{value}}h behind on sleep this week — earlier night tonight." },
    { name: "Pick tomorrow's outfit (rain)", metric: "rainTomorrow", operator: "==", value: 1, action: "attention", telegram: false, message: "🌧️ Rain expected tomorrow — plan waterproof shoes tonight." },
    { name: "Overdue tasks", metric: "overdueTasks", operator: ">=", value: 1, action: "attention", telegram: false, message: "⏰ {{value}} task(s) overdue." },
  ];
}
