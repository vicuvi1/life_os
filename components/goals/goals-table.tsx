"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, MoreVertical, Pencil, Trash2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MomentumChip } from "@/components/goals/goal-card";
import { useToast } from "@/components/toast/toast-provider";
import {
  updateGoal,
  setGoalManualProgress,
  setGoalCurrentValue,
  setGoalFocus,
  deleteGoal,
} from "@/lib/firebase/db";
import {
  goalMomentum,
  goalPace,
  goalStale,
  goalBlockers,
  goalDeadline,
  categoryLabel,
  CATEGORY_SUGGESTIONS,
} from "@/lib/goals";
import { GOAL_STATUSES, GOAL_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Goal, GoalStatus } from "@/lib/types";

type GroupBy = "none" | "category" | "year" | "deadline";
type FilterBy = "all" | "active" | "atrisk" | "blocked" | "focus";
type SortBy = "title" | "progress" | "momentum" | "deadline";

const cellControl =
  "rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-border focus:border-primary focus:outline-none";

interface GoalsTableProps {
  goals: Goal[];
  goalsById: Map<string, Goal>;
  today: string;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onToggleFocus: (goal: Goal) => void;
  onChanged: () => void;
}

export function GoalsTable({
  goals,
  goalsById,
  today,
  onEdit,
  onDelete,
  onToggleFocus,
  onChanged,
}: GoalsTableProps) {
  const { toast } = useToast();
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [sortBy, setSortBy] = useState<SortBy>("title");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSel = () => setSelected(new Set());

  const rows = useMemo(() => {
    const match = (g: Goal): boolean => {
      switch (filterBy) {
        case "active":
          return g.status === "active";
        case "focus":
          return g.focus;
        case "blocked":
          return goalBlockers(g, goalsById).length > 0;
        case "atrisk": {
          if (goalStale(g, today)) return true;
          const p = goalPace(g, today);
          return p ? p.tone === "bad" || p.tone === "warn" : false;
        }
        default:
          return true;
      }
    };
    const cmp = (a: Goal, b: Goal): number => {
      switch (sortBy) {
        case "progress":
          return b.progress - a.progress;
        case "momentum":
          return goalMomentum(b, today).score - goalMomentum(a, today).score;
        case "deadline": {
          const ad = a.deadline ?? "9999";
          const bd = b.deadline ?? "9999";
          return ad < bd ? -1 : ad > bd ? 1 : 0;
        }
        default:
          return a.title.localeCompare(b.title);
      }
    };
    return goals.filter(match).sort(cmp);
  }, [goals, goalsById, today, filterBy, sortBy]);

  // Build ordered groups.
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ label: "", items: rows }];
    const keyOf = (g: Goal): string => {
      if (groupBy === "category") return categoryLabel(g.category) ?? "Uncategorized";
      if (groupBy === "year") return g.deadline ? g.deadline.slice(0, 4) : "No date";
      const tone = goalDeadline(g).tone;
      return tone === "overdue"
        ? "Overdue"
        : tone === "soon"
          ? "Soon"
          : tone === "far"
            ? "Later"
            : "No deadline";
    };
    const map = new Map<string, Goal[]>();
    for (const g of rows) {
      const k = keyOf(g);
      const arr = map.get(k) ?? [];
      arr.push(g);
      map.set(k, arr);
    }
    let entries = Array.from(map.entries());
    if (groupBy === "deadline") {
      const order = ["Overdue", "Soon", "Later", "No deadline"];
      entries = entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    } else if (groupBy === "year") {
      entries = entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    } else {
      entries = entries.sort((a, b) => b[1].length - a[1].length);
    }
    return entries.map(([label, items]) => ({ label, items }));
  }, [rows, groupBy]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  async function bulk(fn: (g: Goal) => Promise<void>, verb: string) {
    const gs = goals.filter((g) => selected.has(g.id));
    if (gs.length === 0) return;
    const n = gs.length;
    await Promise.all(gs.map(fn));
    clearSel();
    onChanged();
    toast({ message: `${n} goal${n > 1 ? "s" : ""} ${verb}`, tone: "success" });
  }

  const selectCls =
    "rounded-md border bg-card px-2 py-1 text-xs focus:border-primary focus:outline-none";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          Group
          <select
            className={selectCls}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="none">None</option>
            <option value="category">Category</option>
            <option value="year">Year</option>
            <option value="deadline">Deadline</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Filter
          <select
            className={selectCls}
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterBy)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="atrisk">At risk</option>
            <option value="blocked">Blocked</option>
            <option value="focus">Focus</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Sort
          <select
            className={selectCls}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="title">Title</option>
            <option value="progress">Progress</option>
            <option value="momentum">Momentum</option>
            <option value="deadline">Deadline</option>
          </select>
        </label>
        <span className="ml-auto">{rows.length} shown</span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => bulk((g) => setGoalFocus(g.id, true), "starred")}>
              <Star className="h-3.5 w-3.5" /> Focus
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk((g) => setGoalFocus(g.id, false), "unfocused")}>
              Unfocus
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk((g) => updateGoal(g.id, { status: "archived" }), "archived")}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => bulk((g) => deleteGoal(g.id), "deleted")}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSel}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                />
              </th>
              <th className="w-8 px-2 py-2" />
              <th className="px-2 py-2 font-medium">Goal</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Category</th>
              <th className="px-2 py-2 font-medium">Progress</th>
              <th className="px-2 py-2 font-medium">Momentum</th>
              <th className="px-2 py-2 font-medium">Deadline</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No goals match this filter.
                </td>
              </tr>
            )}
            {groups.map((group) => {
              const avg =
                group.items.length > 0
                  ? Math.round(
                      group.items.reduce((s, g) => s + g.progress, 0) / group.items.length
                    )
                  : 0;
              return (
                <GroupBlock key={group.label || "all"} label={group.label} count={group.items.length} avg={avg}>
                  {group.items.map((g) => (
                    <GoalRow
                      key={g.id}
                      goal={g}
                      today={today}
                      blockers={goalBlockers(g, goalsById)}
                      selected={selected.has(g.id)}
                      onToggleSelect={() => toggleSel(g.id)}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggleFocus={onToggleFocus}
                      onChanged={onChanged}
                    />
                  ))}
                </GroupBlock>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupBlock({
  label,
  count,
  avg,
  children,
}: {
  label: string;
  count: number;
  avg: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {label && (
        <tr className="border-b bg-muted/20">
          <td colSpan={9} className="px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{count}</span>
              <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${avg}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{avg}%</span>
            </div>
          </td>
        </tr>
      )}
      {children}
    </>
  );
}

function GoalRow({
  goal,
  today,
  blockers,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onToggleFocus,
  onChanged,
}: {
  goal: Goal;
  today: string;
  blockers: Goal[];
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onToggleFocus: (goal: Goal) => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [category, setCategory] = useState(goal.category ?? "");
  useEffect(() => setTitle(goal.title), [goal.title]);
  useEffect(() => setCategory(goal.category ?? ""), [goal.category]);

  const momentum = goalMomentum(goal, today);

  const commitTitle = async () => {
    const t = title.trim();
    if (!t || t === goal.title) {
      setTitle(goal.title);
      return;
    }
    await updateGoal(goal.id, { title: t });
    onChanged();
  };
  const commitCategory = async () => {
    const c = category.trim() || null;
    if ((c ?? "") === (goal.category ?? "")) return;
    await updateGoal(goal.id, { category: c });
    onChanged();
  };

  return (
    <tr className={cn("border-b last:border-0 hover:bg-accent/40", selected && "bg-primary/[0.06]")}>
      <td className="px-2 py-1.5 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${goal.title}`}
          className="h-3.5 w-3.5 cursor-pointer accent-primary"
        />
      </td>
      <td className="px-2 py-1.5 align-middle">
        <button
          type="button"
          onClick={() => onToggleFocus(goal)}
          aria-label={goal.focus ? "Remove from focus" : "Add to focus"}
          className={cn(
            "transition-colors",
            goal.focus
              ? "text-amber-400 hover:text-amber-500"
              : "text-muted-foreground/30 hover:text-amber-400"
          )}
        >
          <Star className={cn("h-3.5 w-3.5", goal.focus && "fill-current")} />
        </button>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <div className="flex items-center gap-2">
          {goal.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={goal.image} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
          ) : (
            goal.icon && <span aria-hidden>{goal.icon}</span>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={cn(cellControl, "min-w-0 flex-1 font-medium")}
            aria-label="Goal title"
          />
        </div>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <select
          value={goal.status}
          onChange={async (e) => {
            await updateGoal(goal.id, { status: e.target.value as GoalStatus });
            onChanged();
          }}
          className={cellControl}
          aria-label="Status"
        >
          {GOAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {GOAL_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <input
          list="goals-table-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={commitCategory}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="—"
          className={cn(cellControl, "w-28")}
          aria-label="Category"
        />
        <datalist id="goals-table-categories">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${goal.progress}%` }} />
          </div>
          {goal.measurement === "percentage" ? (
            <NumberField
              value={goal.progress}
              onCommit={async (v) => {
                await setGoalManualProgress(goal.id, v);
                onChanged();
              }}
              min={0}
              max={100}
              decimals={false}
              suffix="%"
              inputClassName="w-12"
              aria-label="Progress percent"
            />
          ) : goal.measurement === "count" ? (
            <NumberField
              value={goal.currentValue}
              onCommit={async (v) => {
                await setGoalCurrentValue({ id: goal.id }, v);
                onChanged();
              }}
              min={0}
              inputClassName="w-12"
              aria-label="Current value"
            />
          ) : (
            <span className="w-10 text-xs text-muted-foreground">{goal.progress}%</span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <MomentumChip m={momentum} />
      </td>
      <td className="px-2 py-1.5 align-middle">
        <input
          type="date"
          value={goal.deadline ?? ""}
          onChange={async (e) => {
            await updateGoal(goal.id, { deadline: e.target.value || null });
            onChanged();
          }}
          className={cn(cellControl, "w-[130px]")}
          aria-label="Deadline"
        />
      </td>
      <td className="px-2 py-1.5 align-middle">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Goal actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/goals/${goal.id}`}>Open goal</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(goal)}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(goal)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {blockers.length > 0 && (
          <span className="sr-only">Blocked by {blockers.map((b) => b.title).join(", ")}</span>
        )}
      </td>
    </tr>
  );
}
