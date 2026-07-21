// Builds the live {{variable}} value map for notification templates from data
// the app already tracks. Only formatting/derivation lives here — no new fields.

import type { HubData } from "@/lib/hub";
import type { Habit, Session } from "@/lib/types";
import {
  formatHours, sleepScore, scoreMeta, sleepGoalStreak, sleepConsistency,
  sleepDebt, recoveryScore, energyToday, timeInBedHours, minutesToHM,
} from "@/lib/sleep";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface NotifValueInput {
  data: HubData;
  habits: Habit[];
  sessions: Session[];
  name: string;
  now: Date;
}

/** Resolve every catalog variable to a display string (missing → "" so fallbacks apply). */
export function buildNotifValues(input: NotifValueInput): Record<string, string> {
  const { data, habits, sessions, name, now } = input;
  const today = data.today;
  const target = data.sleepTarget;
  const last = data.sleep.find((s) => s.date === today) ?? data.sleep[0] ?? null;

  const debt = sleepDebt(data.sleep, target, today, 7);
  const streak = sleepGoalStreak(data.sleep, target, today);
  const cons = sleepConsistency(data.sleep);
  const recovery = last ? recoveryScore(last, debt, target) : 0;
  const energy = last ? energyToday(recovery, streak) : 0;

  const remaining = habits.filter((h) => !h.archived && h.lastCompleted !== today).length;
  const habitStreak = habits.reduce((m, h) => Math.max(m, h.streak ?? 0), 0);

  const todaySessions = sessions
    .filter((s) => s.date === today && s.status !== "skipped")
    .sort((a, b) => a.startMin - b.startMin);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = todaySessions.find((s) => s.startMin >= nowMin) ?? todaySessions[0];

  return {
    sleep_score: last ? String(sleepScore(last, target)) : "",
    duration: last ? formatHours(last.hours) : "",
    bedtime: last?.bedtime ?? "",
    wake_time: last?.wakeTime ?? "",
    recovery: last ? scoreMeta(recovery).label : "",
    energy: last ? `${energy}%` : "",
    sleep_goal: `${target}h`,
    sleep_debt: debt < 0 ? formatHours(Math.abs(debt)) : debt > 0 ? "none (surplus)" : "none",
    consistency: cons != null ? `${cons}%` : "",
    streak: String(streak),
    remaining_habits: String(remaining),
    habit_streak: String(habitStreak),
    next_event: upcoming ? `${upcoming.title} at ${minutesToHM(upcoming.startMin)}` : "",
    meetings_today: String(todaySessions.length),
    weather: data.weather?.label ?? "",
    temperature: data.weather ? `${data.weather.temp}°C` : "",
    time: minutesToHM(nowMin),
    date: `${MONTHS[now.getMonth()]} ${now.getDate()}`,
    weekday: WEEKDAYS[now.getDay()],
    name,
  };
}

/** For the sleep-log auto-send: values from the just-saved night (no reload needed). */
export function sleepLogValues(input: { hours: number; quality: number; bedtime: string | null; wakeTime: string | null; awakeMinutes: number; target: number; name: string }): Record<string, string> {
  const log = { hours: input.hours, quality: input.quality, bedtime: input.bedtime, wakeTime: input.wakeTime, awakeMinutes: input.awakeMinutes };
  const tib = timeInBedHours(log);
  return {
    sleep_score: String(sleepScore(log, input.target)),
    duration: formatHours(input.hours),
    bedtime: input.bedtime ?? "",
    wake_time: input.wakeTime ?? "",
    recovery: scoreMeta(sleepScore(log, input.target)).label,
    energy: "",
    sleep_goal: `${input.target}h`,
    sleep_debt: "",
    consistency: tib > 0 ? `${Math.round((input.hours / tib) * 100)}%` : "",
    streak: "",
    name: input.name,
  };
}
