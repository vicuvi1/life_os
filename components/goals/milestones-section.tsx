"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Flag,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberField } from "@/components/ui/number-field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MilestoneFormDialog } from "@/components/goals/milestone-form-dialog";
import { updateGoalMilestones } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import {
  autoAdvanceMilestones,
  goalDeadline,
  milestoneDetail,
  milestoneFraction,
  milestoneReadyToComplete,
  sortMilestones,
} from "@/lib/goals";
import { cn } from "@/lib/utils";
import type { Goal, GoalMilestone, Task } from "@/lib/types";

interface Props {
  goal: Goal;
  tasks: Task[];
  onSaved: () => void;
}

export function MilestonesSection({ goal, tasks, onSaved }: Props) {
  const today = toDateKey(new Date());
  const milestones = sortMilestones(goal.milestones);
  const doneTaskIds = new Set(tasks.filter((t) => t.status === "done").map((t) => t.id));

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ open: boolean; milestone: GoalMilestone | null }>({
    open: false,
    milestone: null,
  });
  const [deleting, setDeleting] = useState<GoalMilestone | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  async function persist(next: GoalMilestone[]) {
    await updateGoalMilestones(goal.id, next);
    onSaved();
  }

  // Auto-complete milestones whose linked tasks are all done.
  const autoRan = useRef(false);
  useEffect(() => {
    const { milestones: next, changed } = autoAdvanceMilestones(
      goal.milestones,
      doneTaskIds,
      today
    );
    if (changed && !autoRan.current) {
      autoRan.current = true;
      persist(next);
    }
    if (!changed) autoRan.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.milestones, tasks]);

  function upsert(m: GoalMilestone) {
    const exists = goal.milestones.some((x) => x.id === m.id);
    const next = exists
      ? goal.milestones.map((x) => (x.id === m.id ? m : x))
      : [...goal.milestones, m];
    persist(next);
  }
  function toggleDone(m: GoalMilestone) {
    persist(
      goal.milestones.map((x) =>
        x.id === m.id
          ? { ...x, done: !x.done, completedDate: !x.done ? today : null }
          : x
      )
    );
  }
  function setCount(m: GoalMilestone, v: number) {
    persist(
      goal.milestones.map((x) => (x.id === m.id ? { ...x, currentValue: v } : x))
    );
  }
  function toggleStep(m: GoalMilestone, stepId: string) {
    persist(
      goal.milestones.map((x) =>
        x.id === m.id
          ? { ...x, steps: x.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) }
          : x
      )
    );
  }
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const ordered = sortMilestones(goal.milestones);
    const from = ordered.findIndex((m) => m.id === fromId);
    const to = ordered.findIndex((m) => m.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    persist(ordered.map((m, i) => ({ ...m, order: i })));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Flag className="h-4 w-4" /> Milestones
          {milestones.length > 0 && (
            <span className="text-xs font-normal">
              · {milestones.filter((m) => m.done).length}/{milestones.length} done
            </span>
          )}
        </h2>
        <Button size="sm" variant="outline" onClick={() => setForm({ open: true, milestone: null })}>
          <Plus className="h-4 w-4" /> Add milestone
        </Button>
      </div>

      {milestones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Break this goal into milestones — smaller, trackable wins.
            </p>
            <Button size="sm" onClick={() => setForm({ open: true, milestone: null })}>
              <Plus className="h-4 w-4" /> Add milestone
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => {
            const frac = milestoneFraction(m);
            const detail = milestoneDetail(m);
            const dl = goalDeadline({ deadline: m.dueDate });
            const isOpen = expanded.has(m.id);
            const canExpand =
              m.measurement !== "check" || m.linkedTaskIds.length > 0;
            const ready = milestoneReadyToComplete(m, doneTaskIds);
            return (
              <Card
                key={m.id}
                draggable
                onDragStart={() => setDragId(m.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) reorder(dragId, m.id);
                  setDragId(null);
                }}
                className={cn(
                  "transition-shadow duration-150 ease-smooth",
                  dragId === m.id && "opacity-50"
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-1 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40" />
                    <span className="mt-0.5 shrink-0">
                      <Checkbox
                        checked={m.done}
                        onCheckedChange={() => toggleDone(m)}
                        aria-label={m.done ? "Mark not done" : "Mark done"}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            canExpand &&
                            setExpanded((prev) => {
                              const n = new Set(prev);
                              if (n.has(m.id)) n.delete(m.id);
                              else n.add(m.id);
                              return n;
                            })
                          }
                          className={cn(
                            "flex-1 truncate text-left text-sm font-medium",
                            m.done && "text-muted-foreground line-through",
                            canExpand && "hover:underline"
                          )}
                        >
                          {m.title}
                        </button>
                        {detail && (
                          <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>
                        )}
                        {canExpand &&
                          (isOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ))}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-smooth"
                          style={{ width: `${Math.round(frac * 100)}%` }}
                        />
                      </div>

                      {/* Meta */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {m.dueDate && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              dl.tone === "overdue" && !m.done && "text-destructive"
                            )}
                          >
                            <CalendarClock className="h-3 w-3" />
                            {dl.label}
                          </span>
                        )}
                        {m.weight !== 1 && <span>weight ×{m.weight}</span>}
                        {m.linkedTaskIds.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {m.linkedTaskIds.filter((id) => doneTaskIds.has(id)).length}/
                            {m.linkedTaskIds.length} tasks
                          </span>
                        )}
                        {ready && (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> linked tasks done — mark complete?
                          </span>
                        )}
                      </div>

                      {/* Expanded body */}
                      {isOpen && (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          {m.measurement === "count" && (
                            <div className="flex items-center gap-2 text-sm">
                              <Target className="h-3.5 w-3.5 text-muted-foreground" />
                              <NumberField
                                value={m.currentValue}
                                onCommit={(v) => setCount(m, v)}
                                min={0}
                                inputClassName="w-16"
                                aria-label="Current value"
                              />
                              <span className="text-muted-foreground">
                                / {m.targetValue}
                                {m.unit ? ` ${m.unit}` : ""}
                              </span>
                            </div>
                          )}
                          {m.measurement === "steps" &&
                            m.steps.map((s) => (
                              <label key={s.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={s.done}
                                  onCheckedChange={() => toggleStep(m, s.id)}
                                  aria-label={s.title}
                                />
                                <span className={cn(s.done && "text-muted-foreground line-through")}>
                                  {s.title}
                                </span>
                              </label>
                            ))}
                          {m.linkedTaskIds.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Linked tasks
                              </p>
                              {m.linkedTaskIds.map((id) => {
                                const t = tasks.find((x) => x.id === id);
                                if (!t) return null;
                                return (
                                  <div key={id} className="flex items-center gap-2 text-sm">
                                    <Check
                                      className={cn(
                                        "h-3.5 w-3.5",
                                        doneTaskIds.has(id)
                                          ? "text-emerald-500"
                                          : "text-muted-foreground/40"
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "truncate",
                                        doneTaskIds.has(id) && "text-muted-foreground line-through"
                                      )}
                                    >
                                      {t.title}
                                    </span>
                                  </div>
                                );
                              })}
                              {m.autoComplete && (
                                <p className="text-[11px] text-muted-foreground/70">
                                  Auto-completes when all linked tasks are done.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Edit milestone"
                        onClick={() => setForm({ open: true, milestone: m })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label="Delete milestone"
                        onClick={() => setDeleting(m)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <MilestoneFormDialog
        open={form.open}
        onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}
        goalTasks={tasks}
        milestone={form.milestone}
        nextOrder={goal.milestones.length}
        onSave={upsert}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this milestone?"
        onConfirm={async () => {
          if (deleting) {
            await persist(goal.milestones.filter((x) => x.id !== deleting.id));
            setDeleting(null);
          }
        }}
      />
    </section>
  );
}
