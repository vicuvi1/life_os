"use client";

import { useState } from "react";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLOCK_META, BLOCK_ORDER, COND_OPERATORS, VARIABLE_GROUPS, defaultBlock } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { NotifBlock, NotifBlockCond, NotifBlockType } from "@/lib/types";

const VAR_KEYS = VARIABLE_GROUPS.flatMap((g) => g.items.map((v) => ({ key: v.key, label: v.label })));

export function NotifBlockEditor({ blocks, onChange }: { blocks: NotifBlock[]; onChange: (b: NotifBlock[]) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function update(id: string, patch: Partial<NotifBlock>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function remove(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }
  function insertAt(id: string, index: number) {
    const without = blocks.filter((b) => b.id !== id);
    const moved = blocks.find((b) => b.id === id);
    if (!moved) return;
    const clamped = Math.max(0, Math.min(index, without.length));
    onChange([...without.slice(0, clamped), moved, ...without.slice(clamped)]);
  }
  function add(type: NotifBlockType) {
    onChange([...blocks, defaultBlock(type, Date.now())]);
    setAddOpen(false);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { if (dragId) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (dragId) { insertAt(dragId, blocks.length); setDragId(null); } }}
        className="space-y-2"
      >
        {blocks.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No blocks yet — add one below.</p>}
        {blocks.map((b, index) => (
          <div
            key={b.id}
            draggable
            onDragStart={() => setDragId(b.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => { if (dragId) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragId) { insertAt(dragId, index); setDragId(null); } }}
            className={cn("rounded-xl border bg-card", dragId === b.id && "opacity-40")}
          >
            <div className="flex items-center gap-2 border-b px-2.5 py-1.5">
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
              <span className="text-sm">{BLOCK_META[b.type].icon}</span>
              <span className="flex-1 text-sm font-medium">{BLOCK_META[b.type].label}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Remove block" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="p-2.5">
              <BlockSettings block={b} onChange={(patch) => update(b.id, patch)} />
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => setAddOpen((o) => !o)}><Plus className="h-4 w-4" /> Add block</Button>
        {addOpen && (
          <div className="absolute z-10 mt-1 grid w-full grid-cols-2 gap-1 rounded-xl border bg-popover p-1.5 shadow-lg sm:grid-cols-3">
            {BLOCK_ORDER.map((t) => (
              <button key={t} type="button" onClick={() => add(t)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-accent">
                <span>{BLOCK_META[t].icon}</span> {BLOCK_META[t].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlockSettings({ block, onChange }: { block: NotifBlock; onChange: (patch: Partial<NotifBlock>) => void }) {
  if (block.type === "text") {
    return <Textarea value={block.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="Text — {{variables}} allowed" className="text-sm" />;
  }
  if (block.type === "streak") {
    return (
      <Select value={block.streak ?? "sleep"} onValueChange={(v) => onChange({ streak: v as "sleep" | "habit" })}>
        <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sleep">Sleep goal streak</SelectItem>
          <SelectItem value="habit">Best habit streak</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (block.type === "conditional") {
    return <ConditionalForm cond={block.cond!} onChange={(cond) => onChange({ cond })} />;
  }
  const hint: Record<string, string> = {
    sleep_score: "Shows: 😴 Sleep score {{sleep_score}}/100",
    recommendation: "Shows today's recommendation",
    goal_progress: "Shows: 🎯 {{duration}} / {{sleep_goal}}",
    progress_bar: "Shows a sleep-vs-goal bar",
    weather: "Shows: 🌤 {{weather}}, {{temperature}}",
    calendar: "Shows: 📅 Next: {{next_event}}",
  };
  return <p className="text-xs text-muted-foreground">{hint[block.type] ?? "Auto-filled from your data."}</p>;
}

export function ConditionalForm({ cond, onChange }: { cond: NotifBlockCond; onChange: (c: NotifBlockCond) => void }) {
  const noValue = cond.operator === "is set" || cond.operator === "is not set";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">If</span>
        <Select value={cond.variable} onValueChange={(v) => onChange({ ...cond, variable: v })}>
          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-56">{VAR_KEYS.map((v) => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cond.operator} onValueChange={(v) => onChange({ ...cond, operator: v })}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{COND_OPERATORS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        {!noValue && <Input value={cond.value} onChange={(e) => onChange({ ...cond, value: e.target.value })} placeholder="value" className="h-8 w-20" />}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Then show</p>
          <Textarea value={cond.then} onChange={(e) => onChange({ ...cond, then: e.target.value })} rows={2} className="text-sm" placeholder="Text if true" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Else show</p>
          <Textarea value={cond.else} onChange={(e) => onChange({ ...cond, else: e.target.value })} rows={2} className="text-sm" placeholder="Text if false" />
        </div>
      </div>
    </div>
  );
}
