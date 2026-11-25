import { describe, it, expect } from "vitest";
import {
  buildGoalPlan,
  dayLoadMin,
  goalHealth,
  goalTaskStats,
  isAfterDeadline,
  isDateKey,
  isOverLimit,
  isTaskOverdue,
  isTaskUnscheduled,
  milestonesByDate,
  minutesLabel,
  relativeDayLabel,
  taskEstimateMin,
} from "@/lib/planner";
import { makeMilestone } from "@/lib/goals";
import type { GoalMilestone, Task } from "@/lib/types";

const TODAY = "2026-11-25";

function task(p: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: null,
    goalId: "g1",
    userId: "u",
    title: "Task",
    description: null,
    status: "todo",
    priority: "medium",
    dueDate: null,
    milestoneId: null,
    estimatedMinutes: null,
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

function milestone(p: Partial<GoalMilestone> = {}): GoalMilestone {
  return { ...makeMilestone(0), ...p };
}

describe("task timing", () => {
  it("flags open tasks scheduled before today as overdue", () => {
    expect(isTaskOverdue(task({ dueDate: "2026-11-24" }), TODAY)).toBe(true);
    expect(isTaskOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isTaskOverdue(task({ dueDate: "2026-11-24", status: "done" }), TODAY)).toBe(false);
    expect(isTaskOverdue(task(), TODAY)).toBe(false);
  });

  it("compares across month and year boundaries", () => {
    expect(isTaskOverdue(task({ dueDate: "2025-12-31" }), "2026-01-01")).toBe(true);
    expect(isTaskOverdue(task({ dueDate: "2026-12-01" }), "2026-11-30")).toBe(false);
  });

  it("treats open tasks with no day as unscheduled", () => {
    expect(isTaskUnscheduled(task())).toBe(true);
    expect(isTaskUnscheduled(task({ dueDate: TODAY }))).toBe(false);
    expect(isTaskUnscheduled(task({ status: "done" }))).toBe(false);
  });

  it("validates date keys", () => {
    expect(isDateKey("2026-11-25")).toBe(true);
    expect(isDateKey("2026-11-25T00:00:00Z")).toBe(false);
    expect(isDateKey("")).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
});

describe("day load", () => {
  it("prefers the explicit estimate, then the time block, then 0", () => {
    expect(taskEstimateMin(task({ estimatedMinutes: 45, startMin: 0, endMin: 120 }))).toBe(45);
    expect(taskEstimateMin(task({ startMin: 540, endMin: 600 }))).toBe(60);
    expect(taskEstimateMin(task())).toBe(0);
  });

  it("sums a day and compares it to the limit", () => {
    const load = dayLoadMin([
      task({ estimatedMinutes: 90 }),
      task({ estimatedMinutes: 60 }),
      task({ startMin: 600, endMin: 645 }),
    ]);
    expect(load).toBe(195);
    expect(isOverLimit(load, 180)).toBe(true);
    expect(isOverLimit(180, 180)).toBe(false);
    expect(isOverLimit(500, 0)).toBe(false);
  });
});

describe("deadline warning", () => {
  it("warns only when the day is after the goal's deadline", () => {
    expect(isAfterDeadline("2026-12-02", { deadline: "2026-12-01" })).toBe(true);
    expect(isAfterDeadline("2026-12-01", { deadline: "2026-12-01" })).toBe(false);
    expect(isAfterDeadline("2026-12-02", { deadline: null })).toBe(false);
    expect(isAfterDeadline(null, { deadline: "2026-12-01" })).toBe(false);
    expect(isAfterDeadline("2026-12-02", null)).toBe(false);
  });
});

describe("goalTaskStats", () => {
  it("counts only the goal's own tasks", () => {
    const tasks = [
      task({ id: "a", status: "done" }),
      task({ id: "b" }),
      task({ id: "c" }),
      task({ id: "d", goalId: "other", status: "done" }),
    ];
    expect(goalTaskStats("g1", tasks)).toEqual({ done: 1, total: 3, percent: 33 });
    expect(goalTaskStats("none", tasks)).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("goalHealth", () => {
  it("is on track with no tasks or only future/done work", () => {
    expect(goalHealth({ id: "g1", milestones: [] }, [], TODAY).status).toBe("on_track");
    const tasks = [
      task({ id: "a", dueDate: "2026-11-30" }),
      task({ id: "b", dueDate: "2026-11-01", status: "done" }),
      task({ id: "c" }),
    ];
    const h = goalHealth({ id: "g1", milestones: [] }, tasks, TODAY);
    expect(h.status).toBe("on_track");
    expect(h.label).toBe("On track");
    expect(h.reason).toBeNull();
  });

  it("is behind when a task is overdue", () => {
    const h = goalHealth({ id: "g1", milestones: [] }, [task({ dueDate: "2026-11-24" })], TODAY);
    expect(h.status).toBe("behind");
    expect(h.overdueTasks).toBe(1);
    expect(h.reason).toBe("1 overdue task");
  });

  it("ignores other goals' overdue tasks", () => {
    const h = goalHealth(
      { id: "g1", milestones: [] },
      [task({ goalId: "g2", dueDate: "2026-11-01" })],
      TODAY
    );
    expect(h.status).toBe("on_track");
  });

  it("is behind when a milestone date passed with open tasks", () => {
    const m = milestone({ id: "m1", dueDate: "2026-11-20" });
    // The open task is scheduled in the future, so only the milestone rule fires.
    const tasks = [task({ id: "a", milestoneId: "m1", dueDate: "2026-11-28" })];
    const h = goalHealth({ id: "g1", milestones: [m] }, tasks, TODAY);
    expect(h.status).toBe("behind");
    expect(h.overdueTasks).toBe(0);
    expect(h.missedMilestones).toBe(1);
    expect(h.reason).toBe("1 milestone past its date");
  });

  it("honours legacy task links stored on the milestone", () => {
    const m = milestone({ id: "m1", dueDate: "2026-11-20", linkedTaskIds: ["a"] });
    const h = goalHealth({ id: "g1", milestones: [m] }, [task({ id: "a" })], TODAY);
    expect(h.missedMilestones).toBe(1);
  });

  it("is on track when a past milestone has no open tasks, or is due today", () => {
    const past = milestone({ id: "m1", dueDate: "2026-11-20" });
    const todayM = milestone({ id: "m2", dueDate: TODAY });
    const tasks = [
      task({ id: "a", milestoneId: "m1", status: "done" }),
      task({ id: "b", milestoneId: "m2" }),
    ];
    expect(goalHealth({ id: "g1", milestones: [past, todayM] }, tasks, TODAY).status).toBe(
      "on_track"
    );
  });
});

describe("buildGoalPlan", () => {
  it("orders milestones by date with undated last", () => {
    const ms = [
      milestone({ id: "late", dueDate: "2026-12-20", order: 0 }),
      milestone({ id: "none", dueDate: null, order: 1 }),
      milestone({ id: "early", dueDate: "2026-12-01", order: 2 }),
    ];
    expect(milestonesByDate(ms).map((m) => m.id)).toEqual(["early", "late", "none"]);
  });

  it("groups tasks under milestones, with orphans ungrouped and a backlog", () => {
    const ms = [milestone({ id: "m1", dueDate: "2026-12-01" })];
    const tasks = [
      task({ id: "a", milestoneId: "m1", dueDate: "2026-11-28" }),
      task({ id: "b", milestoneId: "m1" }),
      task({ id: "c", milestoneId: "deleted" }),
      task({ id: "d", dueDate: "2026-11-26" }),
      task({ id: "e", status: "done" }),
    ];
    const plan = buildGoalPlan({ milestones: ms }, tasks);
    expect(plan.groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(plan.ungrouped.map((t) => t.id)).toEqual(["d", "c", "e"]);
    expect(plan.backlog.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });

  it("never lists a task under two milestones", () => {
    const ms = [
      milestone({ id: "m1", dueDate: "2026-12-01", linkedTaskIds: ["a"] }),
      milestone({ id: "m2", dueDate: "2026-12-05" }),
    ];
    const plan = buildGoalPlan({ milestones: ms }, [task({ id: "a", milestoneId: "m2" })]);
    expect(plan.groups.flatMap((g) => g.tasks)).toHaveLength(1);
  });
});

describe("labels", () => {
  it("formats minutes", () => {
    expect(minutesLabel(45)).toBe("45m");
    expect(minutesLabel(60)).toBe("1h");
    expect(minutesLabel(90)).toBe("1h 30m");
    expect(minutesLabel(0)).toBe("");
    expect(minutesLabel(null)).toBe("");
  });

  it("names days next to today", () => {
    expect(relativeDayLabel(TODAY, TODAY)).toBe("Today");
    expect(relativeDayLabel("2026-11-26", TODAY)).toBe("Tomorrow");
    expect(relativeDayLabel("2026-11-24", TODAY)).toBe("Yesterday");
    expect(relativeDayLabel("2026-11-30", "2026-12-01")).toBe("Yesterday");
  });
});
