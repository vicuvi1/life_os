"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, Send, Sparkles, Plus, Trash2, Download, Upload, ChevronLeft, Loader2, Check, RotateCcw, History, Pencil, Clock,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getNotifTemplates, upsertNotifTemplate, getPrefs, getNotifLog, addNotifLog,
  getHabits, getSessions, type NotifTemplateInput,
} from "@/lib/firebase/db";
import { loadHub } from "@/lib/hub-data";
import { buildNotifValues } from "@/lib/notif-values";
import {
  EVENT_ORDER, EVENT_META, VARIABLE_GROUPS, SAMPLE_VALUES, resolveBody, presetsFor, defaultTemplate,
  describeCondition, ACTION_META, ACTIONS, REFERENCE_OPTIONS, DAYS_OPTIONS, STATE_OPTIONS,
  compileBlocks, blockToText, defaultBlock, SCENARIOS, scenarioValues, type VariableDef,
} from "@/lib/notifications";
import { NotifBlockEditor, ConditionalForm } from "@/components/settings/notif-block-editor";
import { callAgentModel, PROVIDER_META } from "@/lib/ai";
import { tgSend } from "@/lib/telegram";
import { resolveFirstName } from "@/lib/greeting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeField } from "@/components/ui/time-field";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AIProviderType, AIProviders, NotifAction, NotifBlockCond, NotifButton, NotifCondition, NotifEventType, NotificationTemplate, NotifLogEntry, TelegramConfig } from "@/lib/types";

type Tab = "template" | "conditions";
const TONES = ["Professional", "Friendly", "Funny", "Minimal", "Formal", "Military", "Stoic", "Gen Z"];

/** Map a button action to an in-app URL (for real Telegram url-buttons). */
function actionUrl(action: string, origin: string): string | null {
  if (action === "open_app") return origin || null;
  if (action === "start_routine" || action === "log_sleep") return origin ? `${origin}/sleep` : null;
  return null; // snooze / dismiss need callback buttons (a bot webhook) — omitted
}

export default function NotificationBuilderPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Record<string, NotificationTemplate>>({});
  const [providers, setProviders] = useState<AIProviders>({});
  const [telegram, setTelegram] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"templates" | "history">("templates");
  const [selected, setSelected] = useState<NotifEventType>("bedtime_reminder");
  const [tab, setTab] = useState<Tab>("template");
  const [log, setLog] = useState<NotifLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>("all");
  const [savedFlash, setSavedFlash] = useState(false);
  const [sendState, setSendState] = useState<{ busy: boolean; msg?: string; ok?: boolean }>({ busy: false });
  const [aiOpen, setAiOpen] = useState(false);
  const [ifElse, setIfElse] = useState<NotifBlockCond | null>(null);
  const [scenario, setScenario] = useState("sample");
  const [inspected, setInspected] = useState<VariableDef | null>(null);
  const [bedtimeTarget, setBedtimeTarget] = useState<string | null>(null);
  const [wakeTarget, setWakeTarget] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [stored, prefs, hist] = await Promise.all([getNotifTemplates(user.uid), getPrefs(user.uid), getNotifLog(user.uid)]);
      const map: Record<string, NotificationTemplate> = {};
      for (const et of EVENT_ORDER) map[et] = stored.find((t) => t.eventType === et) ?? defaultTemplate(user.uid, et);
      setTemplates(map);
      setProviders(prefs.aiProviders ?? {});
      setTelegram(prefs.telegram ?? null);
      setBedtimeTarget(prefs.bedtimeTarget ?? null);
      setWakeTarget(prefs.wakeTarget ?? null);
      setLog(hist);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const tpl = templates[selected];

  function flashSaved() { setSavedFlash(true); window.setTimeout(() => setSavedFlash(false), 1500); }

  const persist = useCallback((et: NotifEventType, next: NotificationTemplate) => {
    if (!user) return;
    const input: NotifTemplateInput = { eventType: et, enabled: next.enabled, body: next.body, mode: next.mode, blocks: next.blocks, buttons: next.buttons, condition: next.condition, stylePreset: next.stylePreset };
    void upsertNotifTemplate(user.uid, input).then(flashSaved);
  }, [user]);

  function patch(partial: Partial<NotificationTemplate>, save = true) {
    setTemplates((prev) => {
      const next = { ...prev[selected], ...partial };
      const map = { ...prev, [selected]: next };
      if (save) persist(selected, next);
      return map;
    });
  }

  function switchMode(m: "text" | "blocks") {
    if (m === tpl.mode) return;
    if (m === "blocks") {
      const blocks = tpl.blocks.length ? tpl.blocks : tpl.body.trim() ? [defaultBlock("text", Date.now())] : [];
      if (blocks.length === 1 && blocks[0].type === "text" && !tpl.blocks.length) blocks[0].text = tpl.body;
      patch({ mode: "blocks", blocks, body: compileBlocks(blocks) });
    } else {
      patch({ mode: "text" });
    }
  }
  function handleBlocks(next: Parameters<typeof NotifBlockEditor>[0]["blocks"]) {
    patch({ blocks: next, body: compileBlocks(next), mode: "blocks" });
  }

  function insertText(token: string) {
    const ta = bodyRef.current;
    if (!ta) { patch({ body: `${tpl.body}${token}` }, false); return; }
    const start = ta.selectionStart ?? tpl.body.length;
    const end = ta.selectionEnd ?? start;
    const next = tpl.body.slice(0, start) + token + tpl.body.slice(end);
    patch({ body: next }, false);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + token.length; });
  }
  function insertVariable(v: VariableDef) {
    insertText(`{{${v.key}}}`);
    setInspected(v);
  }

  function sendButtons(): { text: string; url: string }[] {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return tpl.buttons
      .map((b) => ({ text: b.label, url: actionUrl(b.action, origin) }))
      .filter((b): b is { text: string; url: string } => Boolean(b.url));
  }

  async function loadLiveValues(): Promise<Record<string, string>> {
    if (!user) return SAMPLE_VALUES;
    const [hub, habits, sessions] = await Promise.all([loadHub(user.uid), getHabits(user.uid), getSessions(user.uid)]);
    return buildNotifValues({ data: hub.data, habits, sessions, name: resolveFirstName(user.displayName, user.email), now: new Date() });
  }

  async function sendNow() {
    if (!user || !tpl) return;
    if (!telegram?.enabled || !telegram.botToken || !telegram.chatId) {
      setSendState({ busy: false, ok: false, msg: "Connect Telegram in Settings first." });
      return;
    }
    setSendState({ busy: true });
    const values = await loadLiveValues();
    const text = resolveBody(tpl.body, values);
    const r = await tgSend(telegram.botToken, telegram.chatId, text, sendButtons());
    await addNotifLog(user.uid, { eventType: tpl.eventType, body: text, status: r.ok ? "delivered" : "failed" });
    setSendState({ busy: false, ok: r.ok, msg: r.ok ? "Sent — check Telegram." : r.error ?? "Failed." });
    setLog(await getNotifLog(user.uid));
  }

  async function resend(entry: NotifLogEntry) {
    if (!user || !telegram?.botToken || !telegram.chatId) return;
    const r = await tgSend(telegram.botToken, telegram.chatId, entry.body);
    await addNotifLog(user.uid, { eventType: entry.eventType, body: entry.body, status: r.ok ? "delivered" : "failed" });
    setLog(await getNotifLog(user.uid));
  }

  // Today's scheduled fires (enabled, time-based templates) for the timeline.
  const timeline = useMemo(() => {
    const items: { time: string; min: number; label: string; icon: string; note?: string }[] = [];
    for (const et of EVENT_ORDER) {
      const t = templates[et];
      if (!t?.enabled || EVENT_META[et].eventDriven) continue;
      const c = t.condition;
      let min: number | null = null;
      if (c.timeMode === "relative") {
        const base = (c.reference === "bedtime" ? bedtimeTarget : wakeTarget) ?? "";
        const m = /^(\d{1,2}):(\d{2})$/.exec(base);
        if (m) min = ((Number(m[1]) * 60 + Number(m[2]) + c.offsetMin) % 1440 + 1440) % 1440;
      } else {
        const m = /^(\d{1,2}):(\d{2})$/.exec(c.time);
        if (m) min = Number(m[1]) * 60 + Number(m[2]);
      }
      const note = c.days === "weekdays" ? "weekdays" : c.days === "weekends" ? "weekends" : undefined;
      items.push({
        time: min == null ? "needs a target time" : `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`,
        min: min ?? 9999,
        label: EVENT_META[et].label,
        icon: EVENT_META[et].icon,
        note,
      });
    }
    return items.sort((a, b) => a.min - b.min);
  }, [templates, bedtimeTarget, wakeTarget]);

  function usedIn(key: string): string[] {
    return EVENT_ORDER.filter((et) => templates[et]?.body.includes(`{{${key}}}`)).map((et) => EVENT_META[et].label);
  }

  function exportTemplate() {
    if (!tpl) return;
    const payload = { eventType: tpl.eventType, body: tpl.body, buttons: tpl.buttons, condition: tpl.condition, stylePreset: tpl.stylePreset, enabled: tpl.enabled, _lifeos: "notification-template@1" };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lifeos-${tpl.eventType}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importTemplate(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result));
        if (!p.body) throw new Error("bad file");
        const et = (EVENT_ORDER as string[]).includes(p.eventType) ? (p.eventType as NotifEventType) : selected;
        setSelected(et);
        patch({
          body: String(p.body),
          buttons: Array.isArray(p.buttons) ? p.buttons : tpl.buttons,
          condition: p.condition ?? tpl.condition,
          stylePreset: p.stylePreset ?? "Custom",
          enabled: p.enabled ?? tpl.enabled,
        });
      } catch {
        setSendState({ busy: false, ok: false, msg: "Couldn't read that file." });
      }
    };
    reader.readAsText(file);
  }

  const filteredLog = useMemo(() => (logFilter === "all" ? log : log.filter((l) => l.eventType === logFilter)), [log, logFilter]);
  const hasAnyKey = Boolean(providers.anthropic?.apiKey || providers.gemini?.apiKey);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/settings" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Settings</Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Bell className="h-6 w-6 text-primary" /> Notification builder</h1>
          <p className="text-muted-foreground">Customise every notification — wording, timing, and buttons.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
          {(["templates", "history"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize transition", view === v ? "bg-background shadow-sm" : "text-muted-foreground")}>{v}</button>
          ))}
        </div>
      </div>

      {loading || !tpl ? (
        <SkeletonCard lines={8} />
      ) : view === "history" ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><History className="h-3.5 w-3.5" /> Delivery history</span>
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {EVENT_ORDER.map((et) => <SelectItem key={et} value={et}>{EVENT_META[et].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filteredLog.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing sent yet. Use “Send now” to test a template.</p>
          ) : (
            <div className="divide-y">
              {filteredLog.map((l) => (
                <div key={l.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span>{EVENT_META[l.eventType as NotifEventType]?.icon ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{EVENT_META[l.eventType as NotifEventType]?.label ?? l.eventType}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.body}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", l.status === "delivered" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400")}>{l.status}</span>
                  <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:block">{new Date(l.createdAt).toLocaleString()}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label="Resend" title="Resend" onClick={() => resend(l)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                  {EVENT_META[l.eventType as NotifEventType] && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label="Edit template" title="Edit template" onClick={() => { setSelected(l.eventType as NotifEventType); setView("templates"); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Today's timeline */}
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2.5"><span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Today&apos;s notifications</span></div>
            {timeline.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-muted-foreground">No time-based notifications enabled. Turn one on and set its time in Conditions.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto p-4">
                {timeline.map((t, i) => (
                  <div key={i} className="flex shrink-0 items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold tabular-nums">{t.time}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">{t.icon} {t.label}{t.note ? ` · ${t.note}` : ""}</p>
                    </div>
                    {i < timeline.length - 1 && <span className="text-muted-foreground/30">→</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          {/* Event list */}
          <div className="space-y-1.5">
            {EVENT_ORDER.map((et) => {
              const t = templates[et];
              return (
                <button key={et} type="button" onClick={() => { setSelected(et); setSendState({ busy: false }); }} className={cn("flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition", et === selected ? "border-primary bg-primary/5" : "border-input hover:bg-accent")}>
                  <span className="text-xl">{EVENT_META[et].icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{EVENT_META[et].label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{t?.enabled ? "On" : "Off"}</span>
                  </span>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", t?.enabled ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{EVENT_META[selected].icon}</span>
                <span className="text-sm font-semibold">{EVENT_META[selected].label}</span>
                {savedFlash && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={tpl.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="h-4 w-4 rounded border-input accent-primary" /> Enabled
              </label>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b px-4 pt-2">
              {(["template", "conditions"] as Tab[]).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-t-md px-3 py-1.5 text-xs font-medium capitalize transition", tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground")}>{t}</button>
              ))}
            </div>

            <div className="grid lg:grid-cols-[1fr_300px]">
              {/* Left: editor */}
              <div className="space-y-4 p-4">
                {tab === "template" && (
                  <>
                    {EVENT_META[selected].eventDriven && (
                      <p className="rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">This one sends automatically when you log a night&apos;s sleep.</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                        {(["text", "blocks"] as const).map((m) => (
                          <button key={m} type="button" onClick={() => switchMode(m)} className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize transition", tpl.mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>{m === "text" ? "Text" : "Blocks"}</button>
                        ))}
                      </div>
                      {tpl.mode === "text" && (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => setAiOpen(true)} disabled={!hasAnyKey} title={hasAnyKey ? "" : "Add an AI key in Settings"}><Sparkles className="h-3.5 w-3.5" /> Rewrite</Button>
                      )}
                    </div>

                    {tpl.mode === "blocks" ? (
                      <NotifBlockEditor blocks={tpl.blocks} onChange={handleBlocks} />
                    ) : (
                      <>
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Start from a style</p>
                          <div className="flex flex-wrap gap-1.5">
                            {presetsFor(selected).map((p) => (
                              <button key={p.name} type="button" onClick={() => patch({ body: p.body, stylePreset: p.name, mode: "text", blocks: [] })} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium transition", tpl.stylePreset === p.name ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>{p.name}</button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <Label htmlFor="nb-body">Message</Label>
                            <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => setIfElse({ variable: "sleep_score", operator: "<", value: "70", then: "", else: "" })}>🔀 Insert if/else</Button>
                          </div>
                          <Textarea id="nb-body" ref={bodyRef} value={tpl.body} onChange={(e) => patch({ body: e.target.value }, false)} onBlur={() => persist(selected, tpl)} rows={5} className="font-mono text-sm" />
                        </div>

                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Insert a variable (tap to add &amp; inspect)</p>
                          <div className="space-y-2">
                            {VARIABLE_GROUPS.map((g) => (
                              <div key={g.group} className="flex flex-wrap items-center gap-1">
                                <span className="mr-1 w-14 shrink-0 text-[10px] uppercase text-muted-foreground">{g.group}</span>
                                {g.items.map((v) => (
                                  <button key={v.key} type="button" onClick={() => insertVariable(v)} className={cn("rounded border px-1.5 py-0.5 font-mono text-[11px] transition", inspected?.key === v.key ? "border-primary bg-primary/10 text-foreground" : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground")}>{`{{${v.key}}}`}</button>
                                ))}
                              </div>
                            ))}
                          </div>
                          {inspected && (
                            <div className="mt-2 rounded-lg border bg-muted/20 p-2.5 text-xs">
                              <p className="font-mono text-primary">{`{{${inspected.key}}}`}</p>
                              <p className="mt-1 text-muted-foreground">{inspected.desc}</p>
                              <p className="mt-1"><span className="text-muted-foreground">Example: </span><span className="font-medium">{inspected.sample}</span></p>
                              <p className="mt-0.5"><span className="text-muted-foreground">Used in: </span>{usedIn(inspected.key).length ? usedIn(inspected.key).join(", ") : "not used yet"}</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <ButtonEditor buttons={tpl.buttons} onChange={(b) => patch({ buttons: b })} />
                  </>
                )}

                {tab === "conditions" && (
                  <ConditionEditor eventDriven={Boolean(EVENT_META[selected].eventDriven)} condition={tpl.condition} onChange={(c) => patch({ condition: c })} />
                )}
              </div>

              {/* Right: always-on live preview */}
              <div className="space-y-3 border-t bg-muted/10 p-4 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</span>
                  <Select value={scenario} onValueChange={setScenario}>
                    <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{SCENARIOS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <PhonePreview body={resolveBody(tpl.body, scenarioValues(scenario))} buttons={tpl.buttons} />
                <Button size="sm" className="w-full" onClick={sendNow} disabled={sendState.busy}>{sendState.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send now (live)</Button>
                {sendState.msg && <p className={cn("text-center text-xs", sendState.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{sendState.msg}</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
              <span className="text-[11px] text-muted-foreground">{describeCondition(tpl.condition)}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => patch({ body: presetsFor(selected)[0].body, stylePreset: "Friendly", mode: "text", blocks: [] })} title="Reset to Friendly preset"><RotateCcw className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={exportTemplate} title="Export JSON"><Download className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => fileRef.current?.click()} title="Import JSON"><Upload className="h-3.5 w-3.5" /></Button>
                <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importTemplate(f); e.target.value = ""; }} />
              </div>
            </div>
          </Card>
        </div>
        </>
      )}

      <p className="rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
        Notifications deliver via Telegram. <strong>Send now</strong> works today and the <strong>Sleep logged</strong>
        {" "}template fires automatically when you log a night. Time-scheduled events (bedtime, morning, weekly) fire
        hands-free once the background sender is configured — set <code>CRON_SECRET</code> and
        {" "}<code>FIREBASE_SERVICE_ACCOUNT</code> on Vercel (see <code>.env.example</code>). A Vercel Cron runs the
        sender hourly (Hobby throttles to ~once/day; lower the schedule for finer timing).
      </p>

      {tpl && (
        <AiRewriteDialog open={aiOpen} onOpenChange={setAiOpen} body={tpl.body} providers={providers} onAccept={(b) => { patch({ body: b, stylePreset: "Custom", mode: "text", blocks: [] }); setAiOpen(false); }} />
      )}

      <Dialog open={ifElse !== null} onOpenChange={(o) => !o && setIfElse(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert an if / else</DialogTitle>
            <DialogDescription>Show different text depending on a value at send time.</DialogDescription>
          </DialogHeader>
          {ifElse && <ConditionalForm cond={ifElse} onChange={setIfElse} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIfElse(null)}>Cancel</Button>
            <Button onClick={() => { if (ifElse) { insertText(blockToText({ id: "", type: "conditional", cond: ifElse })); setIfElse(null); } }}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhonePreview({ body, buttons }: { body: string; buttons: NotifButton[] }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl bg-[#17212b] p-3 shadow-lg">
      <div className="flex items-center gap-2 pb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs">L</span>
        <span className="text-xs font-medium text-white/90">Life OS bot</span>
      </div>
      <div className="rounded-xl rounded-tl-sm bg-[#2b5278] px-3 py-2">
        <p className="whitespace-pre-wrap text-sm text-white">{body || "…"}</p>
        {buttons.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-white/15 pt-2">
            {buttons.map((b, i) => <div key={i} className="rounded-md bg-white/10 py-1 text-center text-xs font-medium text-sky-200">{b.label}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function ButtonEditor({ buttons, onChange }: { buttons: NotifButton[]; onChange: (b: NotifButton[]) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Buttons</p>
      <div className="space-y-2">
        {buttons.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={b.label} onChange={(e) => onChange(buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Button label" className="h-9 flex-1" />
            <Select value={b.action} onValueChange={(v) => onChange(buttons.map((x, j) => (j === i ? { ...x, action: v as NotifAction } : x)))}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_META[a]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remove button" onClick={() => onChange(buttons.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {buttons.length < 3 && (
          <Button variant="outline" size="sm" onClick={() => onChange([...buttons, { label: "Open Life OS", action: "open_app" }])}><Plus className="h-4 w-4" /> Add button</Button>
        )}
      </div>
    </div>
  );
}

function ConditionEditor({ eventDriven, condition, onChange }: { eventDriven: boolean; condition: NotifCondition; onChange: (c: NotifCondition) => void }) {
  if (eventDriven) {
    return <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">This notification is event-driven — it fires the moment you log sleep, so it has no timing rule.</p>;
  }
  const before = condition.offsetMin < 0;
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-0.5">
        {(["relative", "absolute"] as const).map((m) => (
          <button key={m} type="button" onClick={() => onChange({ ...condition, timeMode: m })} className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition", condition.timeMode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>{m === "relative" ? "Relative to a time" : "Absolute time"}</button>
        ))}
      </div>

      {condition.timeMode === "relative" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input type="number" min={0} max={720} value={Math.abs(condition.offsetMin)} onChange={(e) => onChange({ ...condition, offsetMin: (before ? -1 : 1) * Math.max(0, Number(e.target.value)) })} className="h-9 w-20" />
          <span className="text-muted-foreground">minutes</span>
          <Select value={before ? "before" : "after"} onValueChange={(v) => onChange({ ...condition, offsetMin: (v === "before" ? -1 : 1) * Math.abs(condition.offsetMin) })}>
            <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="before">before</SelectItem><SelectItem value="after">after</SelectItem></SelectContent>
          </Select>
          <Select value={condition.reference} onValueChange={(v) => onChange({ ...condition, reference: v })}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{REFERENCE_OPTIONS.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">At</Label>
          <div className="w-[180px]"><TimeField value={condition.time} onChange={(t) => onChange({ ...condition, time: t })} step={5} ariaLabel="Notification time" /></div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Days</Label>
        <Select value={condition.days} onValueChange={(v) => onChange({ ...condition, days: v as NotifCondition["days"] })}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>{DAYS_OPTIONS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Only send…</Label>
        {STATE_OPTIONS.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={condition.states.includes(s.key)} onChange={(e) => onChange({ ...condition, states: e.target.checked ? [...condition.states, s.key] : condition.states.filter((x) => x !== s.key) })} className="h-4 w-4 rounded border-input accent-primary" />
            {s.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function AiRewriteDialog({ open, onOpenChange, body, providers, onAccept }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  body: string;
  providers: AIProviders;
  onAccept: (body: string) => void;
}) {
  const [tone, setTone] = useState(TONES[1]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setResult(null); setError(null); setTone(TONES[1]); } }, [open]);

  const provider: AIProviderType | null = providers.anthropic?.apiKey ? "anthropic" : providers.gemini?.apiKey ? "gemini" : null;

  async function rewrite() {
    if (!provider) return;
    const cfg = providers[provider]!;
    setBusy(true);
    setError(null);
    const sys = `You rewrite short push-notification messages. Rewrite the user's message in a ${tone} tone. CRITICAL: keep every {{variable}} placeholder EXACTLY as-is (same names, double braces). Keep it concise (1-2 sentences), keep any emoji sensible. Return ONLY the rewritten message, no quotes or commentary.`;
    const r = await callAgentModel({ provider, model: cfg.model || PROVIDER_META[provider].defaultModel, apiKey: cfg.apiKey, systemPrompt: sys, history: [], userMessage: body });
    setBusy(false);
    if (r.ok && r.text) setResult(r.text.trim());
    else setError(r.error ?? "Rewrite failed.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI rewrite</DialogTitle>
          <DialogDescription>Rewrites the wording in a new tone and keeps every {"{{variable}}"} intact.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={rewrite} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Rewrite</Button>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current</p>
            <p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-2.5 text-sm">{body}</p>
          </div>
          {result && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rewritten</p>
              <p className="whitespace-pre-wrap rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">{result}</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Discard</Button>
          <Button onClick={() => result && onAccept(result)} disabled={!result}><Check className="h-4 w-4" /> Use this</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
