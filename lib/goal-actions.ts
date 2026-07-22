// Shared goal mutations used by both the Goals page and the dashboard, so the
// two surfaces complete a goal's "next action" identically.

import {
  setTaskDone,
  updateGoalMilestones,
  updateGoalSubtasks,
} from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
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
