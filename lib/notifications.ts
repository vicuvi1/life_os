// Notification builder core: event catalog, variable catalog + resolver,
// style presets, condition helpers. Pure/data-only so it's easy to test and
// reuse across the editor, the live preview, and real sends.

import type { NotifAction, NotifCondition, NotifEventType, NotificationTemplate, NotifButton } from "@/lib/types";

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
export interface VariableDef { key: string; label: string; sample: string; fallback: string }

export const VARIABLE_GROUPS: { group: string; items: VariableDef[] }[] = [
  {
    group: "Sleep",
    items: [
      { key: "sleep_score", label: "Sleep score", sample: "82", fallback: "—" },
      { key: "duration", label: "Sleep duration", sample: "7h 45m", fallback: "—" },
      { key: "bedtime", label: "Bedtime", sample: "22:41", fallback: "your usual time" },
      { key: "wake_time", label: "Wake time", sample: "06:29", fallback: "—" },
      { key: "recovery", label: "Recovery", sample: "Excellent", fallback: "—" },
      { key: "energy", label: "Energy", sample: "88%", fallback: "—" },
      { key: "sleep_goal", label: "Sleep goal", sample: "8h", fallback: "your goal" },
      { key: "sleep_debt", label: "Sleep debt", sample: "1h 10m", fallback: "none" },
      { key: "consistency", label: "Consistency", sample: "91%", fallback: "—" },
      { key: "streak", label: "Sleep goal streak", sample: "12", fallback: "0" },
    ],
  },
  {
    group: "Habits",
    items: [
      { key: "remaining_habits", label: "Habits left today", sample: "3", fallback: "0" },
      { key: "habit_streak", label: "Best habit streak", sample: "9", fallback: "0" },
    ],
  },
  {
    group: "Calendar",
    items: [
      { key: "next_event", label: "Next event", sample: "Standup at 10:00", fallback: "nothing scheduled" },
      { key: "meetings_today", label: "Sessions today", sample: "2", fallback: "0" },
    ],
  },
  {
    group: "Weather",
    items: [
      { key: "weather", label: "Conditions", sample: "Partly cloudy", fallback: "—" },
      { key: "temperature", label: "Temperature", sample: "18°C", fallback: "—" },
    ],
  },
  {
    group: "Time",
    items: [
      { key: "time", label: "Current time", sample: "07:15", fallback: "" },
      { key: "date", label: "Date", sample: "Jul 21", fallback: "" },
      { key: "weekday", label: "Weekday", sample: "Tuesday", fallback: "" },
    ],
  },
  { group: "General", items: [{ key: "name", label: "Your name", sample: "Victor", fallback: "there" }] },
];

const ALL_VARS = VARIABLE_GROUPS.flatMap((g) => g.items);
export const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(ALL_VARS.map((v) => [v.key, v.sample]));
const FALLBACKS: Record<string, string> = Object.fromEntries(ALL_VARS.map((v) => [v.key, v.fallback]));

/** Replace {{tokens}} with live values, falling back sensibly when a value is missing. */
export function resolveBody(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v != null && String(v).trim() !== "") return String(v);
    return FALLBACKS[key] ?? "";
  });
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
    buttons: DEFAULT_BUTTONS[eventType].map((b) => ({ ...b })),
    condition: { ...DEFAULT_CONDITION[eventType], states: [...DEFAULT_CONDITION[eventType].states] },
    stylePreset: "Friendly",
    createdAt: 0,
  };
}
