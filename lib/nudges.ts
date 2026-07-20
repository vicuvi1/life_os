import { minToLabel } from "@/lib/sessions";

export interface Nudge {
  id: string;
  title: string;
  detail?: string;
  href: string;
  tone: "default" | "warning" | "success";
}

export interface NudgeInput {
  nowMinutes: number;
  sleepLoggedToday: boolean;
  water: number;
  waterTarget: number;
  habitsDone: number;
  habitsTotal: number;
  tasksDueTodayOpen: number;
  /** Next planned, not-yet-past session today. */
  nextSession: { title: string; startMin: number } | null;
}

/**
 * Compute today's actionable reminders from already-loaded dashboard data,
 * ordered by what's most time-sensitive. Pure and deterministic.
 */
export function buildNudges(input: NudgeInput): Nudge[] {
  const nudges: Nudge[] = [];

  if (input.nextSession && input.nextSession.startMin >= input.nowMinutes) {
    const mins = input.nextSession.startMin - input.nowMinutes;
    nudges.push({
      id: "session",
      title: `Up next: ${input.nextSession.title}`,
      detail:
        mins <= 60
          ? `starts in ${mins} min`
          : `at ${minToLabel(input.nextSession.startMin)}`,
      href: "/sessions",
      tone: "default",
    });
  }

  if (input.tasksDueTodayOpen > 0) {
    nudges.push({
      id: "tasks",
      title: `${input.tasksDueTodayOpen} task${
        input.tasksDueTodayOpen === 1 ? "" : "s"
      } due today`,
      href: "/tasks",
      tone: "warning",
    });
  }

  if (!input.sleepLoggedToday) {
    nudges.push({
      id: "sleep",
      title: "Log last night's sleep",
      detail: "It's the #1 driver of your focus",
      href: "/sleep",
      tone: "default",
    });
  }

  if (input.habitsTotal > 0 && input.habitsDone < input.habitsTotal) {
    const left = input.habitsTotal - input.habitsDone;
    nudges.push({
      id: "habits",
      title: `${left} habit${left === 1 ? "" : "s"} left today`,
      detail: `${input.habitsDone}/${input.habitsTotal} done — keep the streak`,
      href: "/habits",
      tone: "default",
    });
  }

  if (input.water < input.waterTarget) {
    const left = input.waterTarget - input.water;
    nudges.push({
      id: "water",
      title: `Water: ${input.water}/${input.waterTarget} glasses`,
      detail: `${left} more to hit your goal`,
      href: "/nutrition",
      tone: "default",
    });
  }

  return nudges;
}
