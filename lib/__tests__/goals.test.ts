import { describe, it, expect } from "vitest";
import {
  computeGoalProgress,
  goalMomentum,
  goalNextAction,
  goalStale,
  goalBlockers,
  milestonesProgress,
} from "@/lib/goals";
import type { Goal, GoalMilestone, Task } from "@/lib/types";

function goal(p: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    userId: "u",
    title: "Goal",
    description: null,
    status: "active",
    priority: "medium",
    progress: 0,
    measurement: "tasks",
    progressType: "percent",
    targetValue: null,
    currentValue: null,
    unit: null,
    composite: [],
    milestones: [],
    progressLog: [],
    journal: [],
    staleDays: null,
    startDate: null,
    deadline: null,
    quarter: null,
    category: null,
    icon: null,
    color: null,
    focus: false,
    dependsOn: [],
    image: null,
    subtasks: [],
    createdAt: 0,
    ...p,
  };
}

function milestone(p: Partial<GoalMilestone> = {}): GoalMilestone {
  return {
    id: "m1",
    title: "M",
    measurement: "check",
    currentValue: null,
    targetValue: null,
    unit: null,
    weight: 1,
    order: 0,
    dueDate: null,
    completedDate: null,
    done: false,
    linkedTaskIds: [],
    linkedProjectIds: [],
    autoComplete: false,
    steps: [],
    ...p,
  };
}

function task(p: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: null,
    goalId: "g1",
    userId: "u",
    title: "T",
    description: null,
    status: "todo",
    priority: "medium",
    dueDate: null,
    startMin: null,
    endMin: null,
    energy: null,
    location: null,
    tags: [],
    subtasks: [],
    recurrence: null,
    seriesId: null,
    reminders: [],
    completedAt: null,
    sortOrder: 0,
    createdAt: 0,
    ...p,
  };
}

describe("computeGoalProgress", () => {
  it("percentage returns the stored progress", () => {
    expect(computeGoalProgress(goal({ measurement: "percentage", progress: 42 }))).toBe(42);
  });
  it("count is current/target as a %", () => {
    expect(
      computeGoalProgress(goal({ measurement: "count", currentValue: 25, targetValue: 100 }))
    ).toBe(25);
  });
  it("count clamps at 100", () => {
    expect(
      computeGoalProgress(goal({ measurement: "count", currentValue: 150, targetValue: 100 }))
    ).toBe(100);
  });
  it("tasks folds subtasks together with linked tasks", () => {
    const g = goal({
      measurement: "tasks",
      subtasks: [
        { id: "a", title: "", done: true },
        { id: "b", title: "", done: false },
      ],
    });
    // 1 done subtask + 1 done task, out of 2 + 2 = 2/4 = 50%
    expect(computeGoalProgress(g, { taskDone: 1, taskTotal: 2 })).toBe(50);
  });
  it("milestones are weighted", () => {
    const g = goal({
      measurement: "milestones",
      milestones: [milestone({ done: true, weight: 3 }), milestone({ id: "m2", weight: 1 })],
    });
    expect(computeGoalProgress(g)).toBe(75);
  });
  it("linked uses hours logged over the target", () => {
    expect(
      computeGoalProgress(goal({ measurement: "linked", targetValue: 2 }), { linkedMinutes: 60 })
    ).toBe(50);
  });
});

describe("milestonesProgress", () => {
  it("weights each milestone's fraction", () => {
    expect(
      milestonesProgress([milestone({ done: true, weight: 3 }), milestone({ id: "m2", weight: 1 })])
    ).toBe(75);
  });
  it("is 0 with no milestones", () => {
    expect(milestonesProgress([])).toBe(0);
  });
});

describe("goalNextAction", () => {
  it("prefers the first open subtask", () => {
    const g = goal({
      subtasks: [{ id: "s1", title: "Do X", done: false }],
      milestones: [milestone({ title: "Ms" })],
    });
    expect(goalNextAction(g, [])).toMatchObject({ kind: "subtask", title: "Do X" });
  });
  it("falls back to the first open milestone", () => {
    const g = goal({ milestones: [milestone({ title: "Ms" })] });
    expect(goalNextAction(g, [])).toMatchObject({ kind: "milestone", title: "Ms" });
  });
  it("uses an open linked task when there are no subtasks", () => {
    const g = goal();
    const t = task({ title: "Task A" });
    expect(goalNextAction(g, [t])).toMatchObject({ kind: "task", title: "Task A" });
  });
  it("returns null when nothing is actionable", () => {
    expect(goalNextAction(goal(), [])).toBeNull();
  });
});

describe("goalStale", () => {
  const today = "2026-07-23";
  it("is not stale for a brand-new goal", () => {
    const created = new Date(today + "T00:00:00").getTime();
    expect(goalStale(goal({ createdAt: created }), today)).toBe(false);
  });
  it("is stale after the threshold with no progress", () => {
    const created = new Date("2026-07-01T00:00:00").getTime();
    expect(goalStale(goal({ createdAt: created, staleDays: 14 }), today)).toBe(true);
  });
  it("never flags non-active goals", () => {
    const created = new Date("2026-01-01T00:00:00").getTime();
    expect(goalStale(goal({ status: "paused", createdAt: created }), today)).toBe(false);
  });
});

describe("goalBlockers", () => {
  it("returns only still-open dependency goals", () => {
    const done = goal({ id: "b1", status: "completed" });
    const open = goal({ id: "b2", status: "active" });
    const byId = new Map([
      [done.id, done],
      [open.id, open],
    ]);
    const g = goal({ dependsOn: ["b1", "b2", "missing"] });
    expect(goalBlockers(g, byId).map((b) => b.id)).toEqual(["b2"]);
  });
});

describe("goalMomentum", () => {
  it("is New with fewer than 2 log points", () => {
    expect(goalMomentum(goal({ progressLog: [] }), "2026-07-23").label).toBe("New");
  });
  it("reports positive velocity for a rising log", () => {
    const g = goal({
      progressLog: [
        { date: "2026-07-16", value: 0 },
        { date: "2026-07-23", value: 14 },
      ],
    });
    const m = goalMomentum(g, "2026-07-23");
    expect(m.velocityPerWeek).toBeGreaterThan(0);
    expect(["Flying", "Steady", "Warming up"]).toContain(m.label);
  });
});
