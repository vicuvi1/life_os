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
  addTimeEntry,
  autoPlan,
  estimateAccuracy,
  goalProjection,
  goalSpentMin,
  goalTimeline,
  spentByDate,
  sumRange,
  taskSpentMin,
  timerElapsedMin,
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
    timeLog: [],
    timerStartedAt: null,
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

describe("time spent", () => {
  it("merges entries per day and sums them", () => {
    let log = addTimeEntry([], "2026-11-25", 20);
    log = addTimeEntry(log, "2026-11-24", 10);
    log = addTimeEntry(log, "2026-11-25", 15);
    expect(log).toEqual([
      { date: "2026-11-24", minutes: 10 },
      { date: "2026-11-25", minutes: 35 },
    ]);
    expect(addTimeEntry(log, "2026-11-26", 0)).toBe(log);
    expect(taskSpentMin(task({ timeLog: log }))).toBe(45);
  });

  it("rounds a running timer to whole minutes, minimum 1", () => {
    expect(timerElapsedMin(0, 10_000)).toBe(1);
    expect(timerElapsedMin(0, 25 * 60_000 + 20_000)).toBe(25);
  });

  it("adds task time and completed linked sessions per goal and per day", () => {
    const tasks = [
      task({ id: "a", timeLog: [{ date: "2026-11-24", minutes: 30 }] }),
      task({ id: "b", goalId: "g2", timeLog: [{ date: "2026-11-24", minutes: 99 }] }),
    ];
    const sessions = [
      { goalId: "g1", date: "2026-11-25", startMin: 540, endMin: 600, status: "done" as const },
      { goalId: "g1", date: "2026-11-25", startMin: 600, endMin: 660, status: "planned" as const },
      { goalId: null, date: "2026-11-25", startMin: 0, endMin: 60, status: "done" as const },
    ];
    expect(goalSpentMin("g1", tasks, sessions)).toBe(90);
    const g1 = spentByDate(tasks, sessions, "g1");
    expect(g1.get("2026-11-24")).toBe(30);
    expect(g1.get("2026-11-25")).toBe(60);
    const all = spentByDate(tasks, sessions);
    expect(sumRange(all, "2026-11-24", "2026-11-25")).toBe(189);
    expect(sumRange(all, "2026-11-25", "2026-11-25")).toBe(60);
  });

  it("compares estimates with reality over finished tasks only", () => {
    const tasks = [
      task({ id: "a", status: "done", estimatedMinutes: 40, timeLog: [{ date: TODAY, minutes: 60 }] }),
      task({ id: "b", status: "done", estimatedMinutes: 20, timeLog: [{ date: TODAY, minutes: 30 }] }),
      task({ id: "c", estimatedMinutes: 20, timeLog: [{ date: TODAY, minutes: 500 }] }),
      task({ id: "d", status: "done", estimatedMinutes: 20 }),
    ];
    expect(estimateAccuracy(tasks)).toEqual({ sample: 2, estimatedMin: 60, spentMin: 90, ratio: 1.5 });
    expect(estimateAccuracy([task()])).toBeNull();
  });
});

describe("goal timeline", () => {
  it("counts the start day as day 1 and measures time used", () => {
    const tl = goalTimeline({ startDate: "2026-11-16", createdAt: 0, deadline: "2026-12-05" }, TODAY);
    expect(tl.dayNumber).toBe(10);
    expect(tl.totalDays).toBe(20);
    expect(tl.timePercent).toBe(50);
    expect(tl.daysLeft).toBe(10);
  });

  it("falls back to the creation day and copes with no deadline", () => {
    const created = new Date(2026, 10, 24, 15).getTime();
    const tl = goalTimeline({ startDate: null, createdAt: created, deadline: null }, TODAY);
    expect(tl.start).toBe("2026-11-24");
    expect(tl.dayNumber).toBe(2);
    expect(tl.totalDays).toBeNull();
    expect(tl.timePercent).toBeNull();
  });

  it("reports day 0 for a goal that starts in the future", () => {
    expect(
      goalTimeline({ startDate: "2026-12-01", createdAt: 0, deadline: "2026-12-31" }, TODAY).dayNumber
    ).toBe(0);
  });

  it("projects the finish from the pace so far", () => {
    const g = { id: "g1", startDate: "2026-11-16", createdAt: 0, deadline: "2026-11-30" };
    const tasks = [
      task({ id: "a", status: "done" }),
      task({ id: "b", status: "done" }),
      task({ id: "c" }),
      task({ id: "d" }),
    ];
    // 2 done in 10 days -> 5 days per task -> 2 left = 10 more days.
    const p = goalProjection(g, tasks, TODAY);
    expect(p?.date).toBe("2026-12-05");
    expect(p?.daysVsDeadline).toBe(5);
    expect(p?.tasksPerWeek).toBe(1.4);
    expect(goalProjection(g, [task({ id: "a", status: "done" }), task({ id: "b" })], TODAY)).toBeNull();
    expect(goalProjection(g, tasks.slice(0, 2), TODAY)).toBeNull();
  });
});

describe("autoPlan", () => {
  it("fills days up to the limit, earliest deadline first", () => {
    const tasks = [
      task({ id: "busy", dueDate: TODAY, estimatedMinutes: 150 }),
      task({ id: "late", goalId: "gLate", estimatedMinutes: 60, createdAt: 1 }),
      task({ id: "soon", goalId: "gSoon", estimatedMinutes: 60, createdAt: 2 }),
      task({ id: "tiny", goalId: "gLate", estimatedMinutes: 30, createdAt: 3 }),
      task({ id: "done", status: "done" }),
    ];
    const plan = autoPlan(tasks, {
      from: TODAY,
      limitMin: 180,
      deadlines: new Map([
        ["gSoon", "2026-12-01"],
        ["gLate", "2027-01-01"],
      ]),
    });
    expect(plan).toEqual([
      { taskId: "soon", date: "2026-11-26" },
      { taskId: "late", date: "2026-11-26" },
      { taskId: "tiny", date: TODAY },
    ]);
  });

  it("puts an oversized task on the first free day and assumes 30m with no estimate", () => {
    const tasks = [
      task({ id: "x", dueDate: TODAY, estimatedMinutes: 10 }),
      task({ id: "huge", estimatedMinutes: 400, createdAt: 1 }),
      task({ id: "plain", createdAt: 2 }),
    ];
    expect(autoPlan(tasks, { from: TODAY, limitMin: 180 })).toEqual([
      { taskId: "huge", date: "2026-11-26" },
      { taskId: "plain", date: TODAY },
    ]);
  });

  it("leaves tasks unscheduled when nothing fits in the horizon", () => {
    const tasks = [
      task({ id: "full", dueDate: TODAY, estimatedMinutes: 180 }),
      task({ id: "w", estimatedMinutes: 60 }),
    ];
    expect(autoPlan(tasks, { from: TODAY, limitMin: 180, horizonDays: 1 })).toEqual([]);
  });
});
