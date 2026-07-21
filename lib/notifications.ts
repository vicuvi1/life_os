// Notification builder core: event catalog, variable catalog + resolver,
// style presets, condition helpers. Pure/data-only so it's easy to test and
// reuse across the editor, the live preview, and real sends.

import type { NotifAction, NotifBlock, NotifBlockType, NotifCondition, NotifEventType, NotificationTemplate, NotifButton } from "@/lib/types";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export const EVENT_ORDER: NotifEventType[] = [
  "bedtime_reminder",
  "morning_summary",
  "sleep_logged_summary",
  "weekly_review",
  "habit_nudge",
];

export const EVENT_META: Record<NotifEventType, { label: string; icon: string; description: string; eventDriven?: boolean }> = {
  bedtime_reminder: { label: "Bedtime reminder", icon: "🌙", description: "Nudge to wind down before your target bedtime." },
  morning_summary: { label: "Morning summary", icon: "☀️", description: "How you slept + the day ahead, each morning." },
  sleep_logged_summary: { label: "Sleep logged", icon: "😴", description: "Sent automatically whenever you log a night's sleep.", eventDriven: true },
  weekly_review: { label: "Weekly review nudge", icon: "📅", description: "A reminder to run your weekly review." },
  habit_nudge: { label: "Habit nudge", icon: "✅", description: "A push to finish today's remaining habits." },
};

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------
export interface VariableDef { key: string; label: string; sample: string; fallback: string; desc: string }

export const VARIABLE_GROUPS: { group: string; items: VariableDef[] }[] = [
  {
    group: "Sleep",
    items: [
      { key: "sleep_score", label: "Sleep score", sample: "82", fallback: "—", desc: "Latest calculated sleep score (0-100)." },
      { key: "duration", label: "Sleep duration", sample: "7h 45m", fallback: "—", desc: "How long you actually slept last night." },
      { key: "bedtime", label: "Bedtime", sample: "22:41", fallback: "your usual time", desc: "The clock time you went to bed." },
      { key: "wake_time", label: "Wake time", sample: "06:29", fallback: "—", desc: "The clock time you woke up." },
      { key: "recovery", label: "Recovery", sample: "Excellent", fallback: "—", desc: "Recovery rating adjusted for recent sleep debt." },
      { key: "energy", label: "Energy", sample: "88%", fallback: "—", desc: "Predicted energy for today." },
      { key: "sleep_goal", label: "Sleep goal", sample: "8h", fallback: "your goal", desc: "Your nightly target duration." },
      { key: "sleep_debt", label: "Sleep debt", sample: "1h 10m", fallback: "none", desc: "Net shortfall vs goal over the last 7 nights." },
      { key: "consistency", label: "Consistency", sample: "91%", fallback: "—", desc: "How steady your bedtime and wake time are." },
      { key: "streak", label: "Sleep goal streak", sample: "12", fallback: "0", desc: "Consecutive nights that hit your goal." },
      { key: "recommendation", label: "Today's recommendation", sample: "Aim for an earlier night tonight.", fallback: "Keep your routine steady.", desc: "The top personalised tip for today." },
    ],
  },
  {
    group: "Habits",
    items: [
      { key: "remaining_habits", label: "Habits left today", sample: "3", fallback: "0", desc: "Habits not yet completed today." },
      { key: "habit_streak", label: "Best habit streak", sample: "9", fallback: "0", desc: "Your longest active habit streak." },
    ],
  },
  {
    group: "Calendar",
    items: [
      { key: "next_event", label: "Next event", sample: "Standup at 10:00", fallback: "nothing scheduled", desc: "Your next planned session today." },
      { key: "meetings_today", label: "Sessions today", sample: "2", fallback: "0", desc: "How many sessions are planned today." },
    ],
  },
  {
    group: "Weather",
    items: [
      { key: "weather", label: "Conditions", sample: "Partly cloudy", fallback: "—", desc: "Current weather conditions (Chișinău)." },
      { key: "temperature", label: "Temperature", sample: "18°C", fallback: "—", desc: "Current temperature." },
    ],
  },
  {
    group: "Time",
    items: [
      { key: "time", label: "Current time", sample: "07:15", fallback: "", desc: "The time the notification is sent." },
      { key: "date", label: "Date", sample: "Jul 21", fallback: "", desc: "Today's date." },
      { key: "weekday", label: "Weekday", sample: "Tuesday", fallback: "", desc: "The day of the week." },
    ],
  },
  { group: "General", items: [{ key: "name", label: "Your name", sample: "Victor", fallback: "there", desc: "Your first name." }] },
];

/** Preview scenarios — swap the sample data to test how a template renders. */
export const SCENARIOS: { key: string; label: string; values: Record<string, string> }[] = [
  { key: "sample", label: "Sample data", values: {} },
  { key: "good", label: "Good sleep", values: { sleep_score: "94", duration: "8h 20m", bedtime: "22:15", wake_time: "06:35", recovery: "Excellent", energy: "95%", sleep_debt: "none", consistency: "96%", streak: "14", sleep_bar: "█████████░ 96%", recommendation: "You're clear for a full workout and deep work." } },
  { key: "average", label: "Average", values: { sleep_score: "74", duration: "7h 05m", bedtime: "23:20", wake_time: "06:40", recovery: "Good", energy: "78%", sleep_debt: "40m", consistency: "82%", streak: "4", sleep_bar: "███████░░░ 71%", recommendation: "Solid enough — hold your bedtime steady tonight." } },
  { key: "poor", label: "Poor sleep", values: { sleep_score: "48", duration: "5h 20m", bedtime: "01:10", wake_time: "06:30", recovery: "Poor", energy: "41%", sleep_debt: "3h 40m", consistency: "58%", streak: "0", sleep_bar: "█████░░░░░ 53%", recommendation: "Skip hard training and get to bed early tonight." } },
  { key: "none", label: "No sleep logged", values: { sleep_score: "", duration: "", bedtime: "", wake_time: "", recovery: "", energy: "", sleep_debt: "", consistency: "", streak: "0", sleep_bar: "", recommendation: "" } },
  { key: "weekend", label: "Weekend", values: { weekday: "Saturday", date: "Jul 26", meetings_today: "0", next_event: "", remaining_habits: "2" } },
  { key: "vacation", label: "Vacation", values: { weekday: "Friday", meetings_today: "0", next_event: "", remaining_habits: "0", sleep_score: "88", duration: "9h 05m", recovery: "Excellent", energy: "92%" } },
];

/** Merge a scenario's overrides over the base sample values. */
export function scenarioValues(key: string): Record<string, string> {
  const s = SCENARIOS.find((x) => x.key === key);
  return { ...SAMPLE_VALUES, ...(s?.values ?? {}) };
}

const ALL_VARS = VARIABLE_GROUPS.flatMap((g) => g.items);
export const SAMPLE_VALUES: Record<string, string> = {
  ...Object.fromEntries(ALL_VARS.map((v) => [v.key, v.sample])),
  // Widget-only variables (emitted by blocks, not shown in the picker).
  sleep_bar: "███████░░░ 78%",
};
const FALLBACKS: Record<string, string> = Object.fromEntries(ALL_VARS.map((v) => [v.key, v.fallback]));

/** Comparison operators for conditional blocks (kept deliberately simple). */
export const COND_OPERATORS = [
  { key: "<", label: "is less than" },
  { key: ">", label: "is greater than" },
  { key: "=", label: "equals" },
  { key: "is set", label: "is set" },
  { key: "is not set", label: "is not set" },
];

function evalCond(raw: string | undefined, op: string, target: string): boolean {
  const val = (raw ?? "").trim();
  if (op === "is set") return val !== "";
  if (op === "is not set") return val === "";
  const num = parseFloat(val.replace(/[^0-9.-]/g, ""));
  const t = parseFloat(target.replace(/[^0-9.-]/g, ""));
  const bothNum = Number.isFinite(num) && Number.isFinite(t);
  if (op === "<") return bothNum && num < t;
  if (op === ">") return bothNum && num > t;
  if (op === "=") return bothNum ? num === t : val.toLowerCase() === target.trim().toLowerCase();
  return false;
}

/**
 * Resolve a template body: first evaluate single-level conditionals
 * `{{#if var op value}}A{{else}}B{{/if}}`, then substitute `{{tokens}}` with
 * live values (sensible fallback when missing). Not a general expression language.
 */
export function resolveBody(body: string, values: Record<string, string>): string {
  const withCond = body.replace(
    /\{\{#if\s+(\w+)\s*(<|>|=|is not set|is set)\s*([^}]*)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_m, key: string, op: string, rawVal: string, thenT: string, elseT: string | undefined) =>
      evalCond(values[key], op, rawVal.trim()) ? thenT : elseT ?? ""
  );
  return withCond.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v != null && String(v).trim() !== "") return String(v);
    return FALLBACKS[key] ?? "";
  });
}

// ---------------------------------------------------------------------------
// Block builder (Phase 2) — an alternative editor that compiles to `body`.
// ---------------------------------------------------------------------------
export const BLOCK_META: Record<NotifBlockType, { label: string; icon: string }> = {
  text: { label: "Text", icon: "✍️" },
  sleep_score: { label: "Sleep score", icon: "😴" },
  streak: { label: "Streak", icon: "🔥" },
  recovery: { label: "Recovery", icon: "🔋" },
  recommendation: { label: "Recommendation", icon: "💡" },
  goal_progress: { label: "Goal progress", icon: "🎯" },
  progress_bar: { label: "Progress bar", icon: "📊" },
  weather: { label: "Weather", icon: "🌤" },
  calendar: { label: "Calendar event", icon: "📅" },
  quote: { label: "Quote", icon: "❝" },
  divider: { label: "Divider", icon: "➖" },
  conditional: { label: "If / Else", icon: "🔀" },
};
export const BLOCK_ORDER: NotifBlockType[] = [
  "text", "sleep_score", "streak", "recovery", "recommendation", "goal_progress", "progress_bar", "weather", "calendar", "quote", "divider", "conditional",
];

/** Compile one block to its template-text fragment (with {{tokens}} / conditionals). */
export function blockToText(b: NotifBlock): string {
  switch (b.type) {
    case "text": return b.text ?? "";
    case "sleep_score": return "😴 Sleep score {{sleep_score}}/100";
    case "streak": return b.streak === "habit" ? "🔥 Best habit streak: {{habit_streak}}" : "🔥 {{streak}}-night sleep streak";
    case "recommendation": return "💡 {{recommendation}}";
    case "recovery": return "🔋 Recovery: {{recovery}} · energy {{energy}}";
    case "goal_progress": return "🎯 {{duration}} / {{sleep_goal}}";
    case "progress_bar": return "{{sleep_bar}}";
    case "weather": return "🌤 {{weather}}, {{temperature}}";
    case "calendar": return "📅 Next: {{next_event}}";
    case "quote": return b.text ? `“${b.text}”` : "";
    case "divider": return "━━━━━━━━━━";
    case "conditional": {
      const c = b.cond;
      if (!c || !c.variable) return "";
      const val = c.operator === "is set" || c.operator === "is not set" ? "" : ` ${c.value}`;
      return `{{#if ${c.variable} ${c.operator}${val}}}${c.then}{{else}}${c.else}{{/if}}`;
    }
    default: return "";
  }
}

/** Compile a block list into a single body string. */
export function compileBlocks(blocks: NotifBlock[]): string {
  return blocks.map(blockToText).filter((s) => s.trim() !== "").join("\n");
}

export function defaultBlock(type: NotifBlockType, seq: number): NotifBlock {
  return {
    id: `blk-${seq}-${type}`,
    type,
    text: type === "text" ? "" : type === "quote" ? "Sleep is the best meditation." : undefined,
    streak: type === "streak" ? "sleep" : undefined,
    cond: type === "conditional" ? { variable: "sleep_score", operator: "<", value: "70", then: "Take it easy today. 😴", else: "You're clear for a full day. 💪" } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Buttons / conditions
// ---------------------------------------------------------------------------
export const ACTION_META: Record<NotifAction, string> = {
  open_app: "Open app",
  start_routine: "Start routine",
  log_sleep: "Log sleep",
  snooze: "Snooze",
  dismiss: "Dismiss",
};
export const ACTIONS = Object.keys(ACTION_META) as NotifAction[];

export const REFERENCE_OPTIONS = [
  { key: "bedtime", label: "target bedtime" },
  { key: "wake_time", label: "target wake-up" },
];
export const DAYS_OPTIONS = [
  { key: "all", label: "Every day" },
  { key: "weekdays", label: "Weekdays only" },
  { key: "weekends", label: "Weekends only" },
] as const;
export const STATE_OPTIONS = [
  { key: "not_logged_today", label: "only if sleep isn't logged today" },
  { key: "habits_remaining", label: "only if habits remain today" },
];

function hmToMin(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Decide whether a template should fire right now (used by the background
 * sender). Pure — the caller supplies "now" and any state flags from real data.
 */
export function isTemplateDue(
  tpl: NotificationTemplate,
  ctx: {
    bedtimeTarget: string | null;
    wakeTarget: string | null;
    nowMin: number;
    weekday: number; // 0=Sun … 6=Sat
    firedToday: boolean;
    notLoggedToday: boolean;
    habitsRemaining: boolean;
  }
): boolean {
  if (!tpl.enabled || EVENT_META[tpl.eventType].eventDriven || ctx.firedToday) return false;
  const c = tpl.condition;
  if (c.days === "weekdays" && (ctx.weekday === 0 || ctx.weekday === 6)) return false;
  if (c.days === "weekends" && ctx.weekday !== 0 && ctx.weekday !== 6) return false;
  if (c.states.includes("not_logged_today") && !ctx.notLoggedToday) return false;
  if (c.states.includes("habits_remaining") && !ctx.habitsRemaining) return false;

  let targetMin: number | null;
  if (c.timeMode === "relative") {
    const base = hmToMin(c.reference === "bedtime" ? ctx.bedtimeTarget : ctx.wakeTarget);
    targetMin = base == null ? null : ((base + c.offsetMin) % 1440 + 1440) % 1440;
  } else {
    targetMin = hmToMin(c.time);
  }
  if (targetMin == null) return false;
  // Fire on the first run at/after the target time each day (dedup handles repeats).
  return ctx.nowMin >= targetMin;
}

export function describeCondition(cond: NotifCondition): string {
  const day = cond.days === "weekdays" ? " · weekdays" : cond.days === "weekends" ? " · weekends" : "";
  let when: string;
  if (cond.timeMode === "relative") {
    const ref = REFERENCE_OPTIONS.find((r) => r.key === cond.reference)?.label ?? cond.reference;
    const n = Math.abs(cond.offsetMin);
    when = cond.offsetMin === 0 ? `at ${ref}` : `${n} min ${cond.offsetMin < 0 ? "before" : "after"} ${ref}`;
  } else {
    when = `at ${cond.time || "—"}`;
  }
  const states = cond.states.map((s) => STATE_OPTIONS.find((o) => o.key === s)?.label).filter(Boolean);
  return `${when}${day}${states.length ? ` · ${states.join(", ")}` : ""}`;
}

// ---------------------------------------------------------------------------
// Presets + defaults
// ---------------------------------------------------------------------------
export const PRESET_NAMES = ["Friendly", "Minimal", "Coach", "Motivational", "Funny"] as const;

const PRESETS: Record<NotifEventType, Record<string, string>> = {
  bedtime_reminder: {
    Friendly: "🌙 Hey {{name}}, wind-down time. Aim for bed around {{bedtime}} to hit your {{sleep_goal}} goal. Sleep well!",
    Minimal: "🌙 Bedtime {{bedtime}} · goal {{sleep_goal}}.",
    Coach: "🌙 Lights out soon, {{name}}. You're on a {{streak}}-night streak — protect it. Target {{sleep_goal}} tonight.",
    Motivational: "🌙 Great days start the night before. Bed by {{bedtime}}, {{name}} — future you says thanks. 💪",
    Funny: "🌙 Your bed filed a missing-person report. Clock in by {{bedtime}}, {{name}}. 😴",
  },
  morning_summary: {
    Friendly: "☀️ Good morning {{name}}! You slept {{duration}} ({{sleep_score}}/100). Recovery {{recovery}}, energy {{energy}}. {{remaining_habits}} habits left today.",
    Minimal: "☀️ {{duration}} · score {{sleep_score}} · energy {{energy}}",
    Coach: "☀️ {{duration}} logged, recovery {{recovery}}, debt {{sleep_debt}}. Attack the day — {{remaining_habits}} habits to go.",
    Motivational: "☀️ Rise up {{name}}! {{duration}} of fuel, {{energy}} energy. Make {{weekday}} count. 🚀",
    Funny: "☀️ Beep beep. {{duration}} of sleep detected, energy {{energy}}. Coffee optional, greatness mandatory. ☕",
  },
  sleep_logged_summary: {
    Friendly: "😴 Logged {{duration}} — score {{sleep_score}}/100, {{recovery}} recovery. {{bedtime}} → {{wake_time}}.",
    Minimal: "😴 {{duration}} · {{sleep_score}}/100",
    Coach: "😴 {{duration}} vs {{sleep_goal}} goal. Recovery {{recovery}}, debt {{sleep_debt}}, consistency {{consistency}}.",
    Motivational: "😴 Nice — {{duration}} banked! Score {{sleep_score}}, streak {{streak}}. Keep stacking wins. 🔥",
    Funny: "😴 Sleep receipt: {{duration}}, {{sleep_score}}/100. No refunds. 🧾",
  },
  weekly_review: {
    Friendly: "📅 Sunday check-in, {{name}}. Time for your weekly review — 5 minutes to plan a great week.",
    Minimal: "📅 Weekly review time.",
    Coach: "📅 Close the loop, {{name}}: review the week, set 3 priorities. Momentum compounds.",
    Motivational: "📅 New week loading. Review, reset, aim higher, {{name}}. 🎯",
    Funny: "📅 Your week wants a performance review. 5 minutes, {{name}}. 😄",
  },
  habit_nudge: {
    Friendly: "✅ {{name}}, {{remaining_habits}} habits left today. A little now beats a lot later!",
    Minimal: "✅ {{remaining_habits}} habits left.",
    Coach: "✅ {{remaining_habits}} to go. Best streak {{habit_streak}} — don't break the chain.",
    Motivational: "✅ Finish strong, {{name}}! {{remaining_habits}} habits between you and a perfect day. 💪",
    Funny: "✅ Your habits are doing puppy eyes. {{remaining_habits}} left, {{name}}. 🥺",
  },
};

export function presetsFor(eventType: NotifEventType): { name: string; body: string }[] {
  return PRESET_NAMES.map((name) => ({ name, body: PRESETS[eventType][name] }));
}

const DEFAULT_BUTTONS: Record<NotifEventType, NotifButton[]> = {
  bedtime_reminder: [{ label: "Start routine", action: "start_routine" }, { label: "Snooze 15m", action: "snooze" }],
  morning_summary: [{ label: "Open Life OS", action: "open_app" }],
  sleep_logged_summary: [{ label: "Open Life OS", action: "open_app" }],
  weekly_review: [{ label: "Open review", action: "open_app" }],
  habit_nudge: [{ label: "Open habits", action: "open_app" }, { label: "Dismiss", action: "dismiss" }],
};

const DEFAULT_CONDITION: Record<NotifEventType, NotifCondition> = {
  bedtime_reminder: { timeMode: "relative", reference: "bedtime", offsetMin: -30, time: "22:00", days: "all", states: [] },
  morning_summary: { timeMode: "relative", reference: "wake_time", offsetMin: 5, time: "07:00", days: "all", states: [] },
  sleep_logged_summary: { timeMode: "absolute", reference: "wake_time", offsetMin: 0, time: "", days: "all", states: [] },
  weekly_review: { timeMode: "absolute", reference: "wake_time", offsetMin: 0, time: "18:00", days: "weekends", states: [] },
  habit_nudge: { timeMode: "absolute", reference: "wake_time", offsetMin: 0, time: "20:00", days: "all", states: ["habits_remaining"] },
};

/** A fresh template for an event type, seeded from its Friendly preset. */
export function defaultTemplate(userId: string, eventType: NotifEventType): NotificationTemplate {
  return {
    id: "",
    userId,
    eventType,
    enabled: eventType === "sleep_logged_summary",
    body: PRESETS[eventType].Friendly,
    mode: "text",
    blocks: [],
    buttons: DEFAULT_BUTTONS[eventType].map((b) => ({ ...b })),
    condition: { ...DEFAULT_CONDITION[eventType], states: [...DEFAULT_CONDITION[eventType].states] },
    stylePreset: "Friendly",
    createdAt: 0,
  };
}
