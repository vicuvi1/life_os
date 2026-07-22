import { describe, it, expect } from "vitest";
import { buildPriorityStack, type PriorityInput } from "@/lib/priority";

const base: PriorityInput = {
  isMonday: false,
  reviewDoneThisWeek: false,
  sleepLoggedToday: true,
  habitsRemaining: [],
  habitsTotal: 0,
  water: 8,
  waterTarget: 8,
  trackersDue: [],
  tasksDueToday: [],
  nextSession: null,
  hiddenTrackers: [],
};

describe("buildPriorityStack", () => {
  it("is empty when everything is already logged", () => {
    expect(buildPriorityStack(base)).toEqual([]);
  });
  it("adds a sleep nudge when sleep isn't logged", () => {
    const stack = buildPriorityStack({ ...base, sleepLoggedToday: false });
    expect(stack.some((i) => i.kind === "sleep")).toBe(true);
  });
  it("respects hidden trackers", () => {
    const stack = buildPriorityStack({
      ...base,
      sleepLoggedToday: false,
      hiddenTrackers: ["sleep"],
    });
    expect(stack.some((i) => i.kind === "sleep")).toBe(false);
  });
  it("adds water when below target", () => {
    expect(buildPriorityStack({ ...base, water: 2 }).some((i) => i.kind === "water")).toBe(true);
  });
  it("puts the Monday review first", () => {
    const stack = buildPriorityStack({ ...base, isMonday: true, sleepLoggedToday: false });
    expect(stack[0]?.kind).toBe("monday");
  });
  it("omits the Monday review once it's done", () => {
    const stack = buildPriorityStack({ ...base, isMonday: true, reviewDoneThisWeek: true });
    expect(stack.some((i) => i.kind === "monday")).toBe(false);
  });
});
