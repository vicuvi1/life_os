"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTask,
  updateTask,
  getGoals,
  getProjects,
  type TaskInput,
} from "@/lib/firebase/db";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/labels";
import { minToLabel, minToTime, timeToMin } from "@/lib/sessions";
import {
  DURATION_OPTIONS,
  makeSubtask,
  RECURRENCE_FREQS,
  RECURRENCE_LABEL,
  REMINDER_OPTIONS,
  WEEKDAY_CHIPS,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type {
  Goal,
  Priority,
  Project,
  Subtask,
  Task,
  TaskRecurrence,
  TaskRecurrenceFreq,
} from "@/lib/types";

type RepeatMode = "none" | TaskRecurrenceFreq;

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  goalId: string | null;
  projectId?: string | null;
  task?: Task | null;
  onSaved: () => void;
  /** Prefill for "add to this day/time" from the calendar (create mode only). */
  defaults?: {
    dueDate?: string | null;
    startMin?: number | null;
    endMin?: number | null;
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  userId,
  goalId,
  projectId = null,
  task,
  onSaved,
  defaults,
}: Props) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [startTime, setStartTime] = useState(""); // "HH:mm"
  const [durationMin, setDurationMin] = useState(60);
  const [energy, setEnergy] = useState(0); // 0 = not set
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subDraft, setSubDraft] = useState("");
  const [subMinsDraft, setSubMinsDraft] = useState("");
  const [goalSel, setGoalSel] = useState<string>(NONE);
  const [projectSel, setProjectSel] = useState<string>(NONE);
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthDay, setMonthDay] = useState(1);
  const [repeatEnd, setRepeatEnd] = useState("");
  const [reminders, setReminders] = useState<number[]>([]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load goals + projects for the selectors (once per open).
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    Promise.all([getGoals(userId), getProjects(userId)])
      .then(([g, p]) => {
        if (!cancelled) {
          setGoals(g);
          setProjects(p);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Hydrate the form whenever it opens.
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "medium");
    setDueDate(task?.dueDate ?? defaults?.dueDate ?? "");
    const sMin = task?.startMin ?? defaults?.startMin ?? null;
    const eMin = task?.endMin ?? defaults?.endMin ?? null;
    setStartTime(sMin != null ? minToTime(sMin) : "");
    setDurationMin(sMin != null && eMin != null && eMin > sMin ? eMin - sMin : 60);
    setEnergy(task?.energy ?? 0);
    setLocation(task?.location ?? "");
    setTags(task?.tags ?? []);
    setTagDraft("");
    setSubtasks(task?.subtasks ?? []);
    setSubDraft("");
    setSubMinsDraft("");
    setGoalSel(task?.goalId ?? goalId ?? NONE);
    setProjectSel(task?.projectId ?? projectId ?? NONE);
    const rec = task?.recurrence ?? null;
    const anchorKey = task?.dueDate ?? defaults?.dueDate ?? "";
    const anchorDay = anchorKey ? new Date(anchorKey + "T00:00:00") : new Date();
    setRepeat(rec?.frequency ?? "none");
    setWeekdays(rec && rec.weekdays.length ? rec.weekdays : [anchorDay.getDay()]);
    setMonthDay(rec?.dayOfMonth ?? anchorDay.getDate());
    setRepeatEnd(rec?.endDate ?? "");
    setReminders(task?.reminders ?? []);
    setError(null);
  }, [open, task, goalId, projectId, defaults]);

  const goalProjects = projects.filter(
    (p) => goalSel !== NONE && p.goalId === goalSel
  );

  const startMinNum = startTime ? timeToMin(startTime) : null;
  const endLabel =
    startMinNum != null ? minToLabel(startMinNum + durationMin) : null;

  function addTag() {
    const v = tagDraft.trim();
    if (!v || tags.includes(v)) {
      setTagDraft("");
      return;
    }
    setTags((prev) => [...prev, v]);
    setTagDraft("");
  }

  function addSubtask() {
    const v = subDraft.trim();
    if (!v) return;
    const mins = subMinsDraft ? Number(subMinsDraft) : null;
    setSubtasks((prev) => [
      ...prev,
      makeSubtask(v, mins && mins > 0 ? mins : null),
    ]);
    setSubDraft("");
    setSubMinsDraft("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give your task a title.");
      return;
    }
    setSaving(true);
    setError(null);

    const startMin = startTime ? timeToMin(startTime) : null;
    const endMin = startMin != null ? startMin + durationMin : null;
    const goalIdOut = goalSel === NONE ? null : goalSel;
    // A project only makes sense under its own goal.
    const projectIdOut =
      projectSel === NONE ||
      !projects.some((p) => p.id === projectSel && p.goalId === goalIdOut)
        ? null
        : projectSel;

    let recurrence: TaskRecurrence | null = null;
    if (repeat !== "none") {
      recurrence = {
        frequency: repeat,
        weekdays: repeat === "weekly" ? [...weekdays].sort((a, b) => a - b) : [],
        dayOfMonth: repeat === "monthly" ? monthDay : null,
        endDate: repeatEnd || null,
      };
    }

    const payload: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      dueDate: dueDate || null,
      goalId: goalIdOut,
      projectId: projectIdOut,
      startMin,
      endMin,
      energy: energy === 0 ? null : energy,
      location: location.trim() || null,
      tags,
      subtasks,
      reminders,
      recurrence,
    };
    // A series head's seriesId is its own id. On create, pass null and let
    // createTask backfill the new doc id; on edit, anchor to this task's id
    // (promoting an occurrence starts a clean, independent series).
    if (recurrence) payload.seriesId = task?.id ?? null;

    try {
      if (isEdit && task) {
        await updateTask(task.id, payload);
      } else {
        await createTask(userId, payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this task." : "Schedule a task on your calendar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Study Linux CCNA"
              autoFocus
            />
          </div>

          {/* Date + priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="t-due">Date</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Time block */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="t-start">Start time</Label>
              <Input
                id="t-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={String(durationMin)}
                onValueChange={(v) => setDurationMin(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d.min} value={String(d.min)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ends</Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                {endLabel ?? "—"}
              </div>
            </div>
          </div>
          {!startTime && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Leave the start time empty to keep this an all-day task.
            </p>
          )}

          {/* Repeat */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Repeat</Label>
              <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Doesn&apos;t repeat</SelectItem>
                  {RECURRENCE_FREQS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {RECURRENCE_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {repeat !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="t-repeat-end">Until (optional)</Label>
                <Input
                  id="t-repeat-end"
                  type="date"
                  value={repeatEnd}
                  onChange={(e) => setRepeatEnd(e.target.value)}
                />
              </div>
            )}
          </div>
          {repeat === "weekly" && (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_CHIPS.map((c) => {
                const on = weekdays.includes(c.n);
                return (
                  <button
                    key={c.n}
                    type="button"
                    onClick={() =>
                      setWeekdays((prev) =>
                        on ? prev.filter((x) => x !== c.n) : [...prev, c.n]
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}
          {repeat === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="t-monthday">Day of month</Label>
              <Input
                id="t-monthday"
                type="number"
                min={1}
                max={31}
                value={monthDay}
                onChange={(e) =>
                  setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-24"
              />
            </div>
          )}

          {/* Reminders */}
          <div className="space-y-2">
            <Label>Reminders</Label>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_OPTIONS.map((r) => {
                const on = reminders.includes(r.min);
                return (
                  <button
                    key={r.min}
                    type="button"
                    onClick={() =>
                      setReminders((prev) =>
                        on ? prev.filter((x) => x !== r.min) : [...prev, r.min]
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Surfaced in-app as the task approaches. Phone push rides the daily
              notification run.
            </p>
          </div>

          {/* Goal + project */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Goal</Label>
              <Select
                value={goalSel}
                onValueChange={(v) => {
                  setGoalSel(v);
                  setProjectSel(NONE);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No goal</SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={projectSel}
                onValueChange={setProjectSel}
                disabled={goalSel === NONE || goalProjects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No project</SelectItem>
                  {goalProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Energy + location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Energy needed</Label>
                <span className="text-xs font-medium text-muted-foreground">
                  {energy === 0 ? "—" : `${energy}/10`}
                </span>
              </div>
              <Slider value={energy} onValueChange={setEnergy} min={0} max={10} step={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-loc">Location</Label>
              <Input
                id="t-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Desk"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                      aria-label={`Remove ${t}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Type a tag and press Enter"
            />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <Label>Subtasks</Label>
            {subtasks.length > 0 && (
              <div className="space-y-1">
                {subtasks.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <span className="flex-1">{s.title}</span>
                    {s.durationMin != null && (
                      <span className="text-xs text-muted-foreground">
                        {s.durationMin} min
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSubtasks((prev) => prev.filter((x) => x.id !== s.id))
                      }
                      aria-label={`Remove ${s.title}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={subDraft}
                onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add a subtask"
              />
              <Input
                type="number"
                min={0}
                value={subMinsDraft}
                onChange={(e) => setSubMinsDraft(e.target.value)}
                placeholder="min"
                className="w-20"
              />
              <Button type="button" variant="outline" onClick={addSubtask}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="t-description">Description</Label>
            <Textarea
              id="t-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
