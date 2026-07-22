// Shared goal mutations used by both the Goals page and the dashboard, so the
// two surfaces complete a goal's "next action" identically.

import {
  setTaskDone,
  updateGoalMilestones,
  updateGoalSubtasks,
  createSession,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import { addDays } from "@/lib/habits";
import type { NextAction } from "@/lib/goals";
import type { Goal } from "@/lib/types";

/** Mark a goal's computed next action complete (subtask / task / step / milestone). */
export async function completeGoalNextAction(
  goal: Goal,
  action: NextAction
): Promise<void> {
  const today = toDateKey(new Date());
  if (action.kind === "subtask") {
    await updateGoalSubtasks(
      goal.id,
      goal.subtasks.map((s) => (s.id === action.subtaskId ? { ...s, done: true } : s))
    );
  } else if (action.kind === "task") {
    await setTaskDone({ id: action.taskId, goalId: goal.id }, true);
  } else if (action.kind === "step") {
    await updateGoalMilestones(
      goal.id,
      goal.milestones.map((m) =>
        m.id === action.milestoneId
          ? { ...m, steps: m.steps.map((s) => (s.id === action.stepId ? { ...s, done: true } : s)) }
          : m
      )
    );
  } else {
    await updateGoalMilestones(
      goal.id,
      goal.milestones.map((m) =>
        m.id === action.milestoneId ? { ...m, done: true, completedDate: today } : m
      )
    );
  }
}

/**
 * Time-block a goal's next action: create a planned Session (tomorrow, 9–10am)
 * titled by the action and linked to the goal. Returns the session date key.
 */
export async function scheduleGoalAction(
  goal: Goal,
  action: NextAction,
  today: string
): Promise<string> {
  const date = addDays(today, 1);
  await createSession(goal.userId, {
    title: action.title,
    category: "study",
    goalId: goal.id,
    date,
    startMin: 9 * 60,
    endMin: 10 * 60,
    status: "planned",
    quality: null,
    notes: null,
    color: goal.color ?? null,
  });
  return date;
}

/**
 * Undo a completion. `goal` must be the pre-completion snapshot — for
 * subtask/step/milestone actions we simply restore its embedded arrays.
 */
export async function uncompleteGoalNextAction(
  goal: Goal,
  action: NextAction
): Promise<void> {
  if (action.kind === "task") {
    await setTaskDone({ id: action.taskId, goalId: goal.id }, false);
  } else if (action.kind === "subtask") {
    await updateGoalSubtasks(goal.id, goal.subtasks);
  } else {
    await updateGoalMilestones(goal.id, goal.milestones);
  }
}
