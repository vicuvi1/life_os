"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Zap, Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { loadHub, type HubLoad } from "@/lib/hub-data";
import { HUB_METRICS, HUB_OPERATORS, evaluateRule, metricDef, starterAutomations } from "@/lib/hub";
import { createAutomation, updateAutomation, deleteAutomation, type AutomationInput } from "@/lib/firebase/db";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { HubAutomation } from "@/lib/types";

export default function AutomationsPage() {
  const { user } = useAuth();
  const [hub, setHub] = useState<HubLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<HubAutomation | null>(null);
  const [deleting, setDeleting] = useState<HubAutomation | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      setHub(await loadHub(user.uid));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const rules = useMemo(() => hub?.docs.automations ?? [], [hub]);

  async function toggle(rule: HubAutomation) {
    setHub((prev) => prev ? { ...prev, docs: { ...prev.docs, automations: prev.docs.automations.map((a) => a.id === rule.id ? { ...a, enabled: !rule.enabled } : a) } } : prev);
    await updateAutomation(rule.id, { enabled: !rule.enabled });
  }

  async function save(input: AutomationInput) {
    if (!user) return;
    if (editing) await updateAutomation(editing.id, input);
    else await createAutomation(user.uid, input);
    setEditorOpen(false);
    setEditing(null);
    await load({ quiet: true });
  }

  async function seedStarters() {
    if (!user) return;
    setSeeding(true);
    try {
      for (const s of starterAutomations()) await createAutomation(user.uid, { ...s, enabled: true });
      await load({ quiet: true });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Zap className="h-6 w-6 text-amber-500" /> Automations</h1>
          <p className="text-muted-foreground">Rules that watch your data: trigger → condition → action. No code.</p>
        </div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> New rule</Button>
      </div>

      <p className="rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
        Rules evaluate against live data whenever you open the app (hub or this page). Firing writes to your
        notification inbox — and to Telegram if connected — at most once per day per rule.
      </p>

      {loading || !hub ? (
        <SkeletonCard lines={6} />
      ) : rules.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Zap className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No rules yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Start with sensible defaults — laundry threshold, budget warning, sleep debt, rain heads-up — then tweak or add your own.</p>
          <div className="flex gap-2">
            <Button onClick={seedStarters} disabled={seeding}><Sparkles className="h-4 w-4" /> {seeding ? "Adding…" : "Add starter rules"}</Button>
            <Button variant="outline" onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> Build my own</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const def = metricDef(rule.metric);
            const res = evaluateRule(rule, hub.data);
            return (
              <Card key={rule.id} className={cn("flex items-center gap-3 p-3", !rule.enabled && "opacity-55")}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={() => toggle(rule)}
                  className={cn("relative h-5 w-9 shrink-0 rounded-full transition", rule.enabled ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", rule.enabled ? "left-[18px]" : "left-0.5")} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{rule.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {def?.label ?? rule.metric} {rule.operator} {rule.value}
                    {res && <> · now: <span className={res.active ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>{def?.boolean ? (res.current ? "yes" : "no") : res.current}</span></>}
                    {res?.active && " ⚡"}
                    {" · "}{rule.action === "notify" ? `notifies${rule.telegram ? " + Telegram" : ""}` : "attention only"}
                    {rule.lastFired && ` · last fired ${rule.lastFired}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Edit rule" onClick={() => { setEditing(rule); setEditorOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Delete rule" onClick={() => setDeleting(rule)}><Trash2 className="h-4 w-4" /></Button>
              </Card>
            );
          })}
        </div>
      )}

      <RuleEditorDialog open={editorOpen} onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }} rule={editing} onSave={save} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this rule?" onConfirm={async () => { if (deleting) { await deleteAutomation(deleting.id); setDeleting(null); await load({ quiet: true }); } }} />
    </div>
  );
}

function RuleEditorDialog({ open, onOpenChange, rule, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rule: HubAutomation | null;
  onSave: (input: AutomationInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("dirtyCount");
  const [operator, setOperator] = useState<HubAutomation["operator"]>(">=");
  const [value, setValue] = useState("5");
  const [action, setAction] = useState<HubAutomation["action"]>("notify");
  const [telegram, setTelegram] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const def = metricDef(metric);

  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? "");
    setMetric(rule?.metric ?? "dirtyCount");
    setOperator(rule?.operator ?? ">=");
    setValue(String(rule?.value ?? 5));
    setAction(rule?.action ?? "notify");
    setTelegram(rule?.telegram ?? true);
    setMessage(rule?.message ?? "");
  }, [open, rule]);

  // Boolean metrics read best as "is yes".
  useEffect(() => {
    if (def?.boolean) { setOperator("=="); setValue("1"); }
  }, [metric, def?.boolean]);

  async function save() {
    if (!name.trim()) return;
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), metric, operator, value: v, action, telegram, message: message.trim(), enabled: rule?.enabled ?? true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>When the condition is true, the action runs (once per day).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Laundry time" /></div>
          <div className="space-y-1">
            <Label className="text-xs">When</Label>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HUB_METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {def?.boolean ? (
            <p className="text-xs text-muted-foreground">Fires when this is <span className="font-medium">yes</span>.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Is</Label>
                <Select value={operator} onValueChange={(v) => setOperator(v as HubAutomation["operator"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HUB_OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Value</Label><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} /></div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Then</Label>
            <Select value={action} onValueChange={(v) => setAction(v as HubAutomation["action"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="notify">Send a notification</SelectItem>
                <SelectItem value="attention">Show in Needs Attention only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === "notify" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={telegram} onChange={(e) => setTelegram(e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
              Also send to Telegram (if connected)
            </label>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Message — {"{{value}}"} inserts the current number</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`e.g. 🧺 {{value}} items are dirty — laundry time.`} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
