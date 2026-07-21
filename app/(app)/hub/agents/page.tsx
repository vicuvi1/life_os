"use client";

import { SkeletonCard } from "@/components/ui/skeleton";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Plus, Pencil, Trash2, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { loadHub, type HubLoad } from "@/lib/hub-data";
import { HUB_MODULES, defaultAgents, renderPrompt, BASE_PROMPT } from "@/lib/hub";
import { callAgentModel, PROVIDER_META } from "@/lib/ai";
import {
  createHubAgent,
  updateHubAgent,
  deleteHubAgent,
  getConversation,
  saveConversation,
  type HubAgentInput,
} from "@/lib/firebase/db";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { AIProviderType, ChatMessage, HubAgent, HubModule } from "@/lib/types";

function AgentsInner() {
  const { user } = useAuth();
  const search = useSearchParams();
  const [hub, setHub] = useState<HubLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<HubAgent | null>(null);
  const [deleting, setDeleting] = useState<HubAgent | null>(null);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setHub(await loadHub(user.uid));
    } catch {
      // Leave hub null — the page renders its empty state instead of crashing.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const agents: HubAgent[] = useMemo(() => {
    if (!user) return [];
    const stored = hub?.docs.agents ?? [];
    const covered = new Set(stored.map((a) => a.module));
    return [...stored, ...defaultAgents(user.uid).filter((d) => !covered.has(d.module))];
  }, [hub, user]);

  useEffect(() => {
    const fromUrl = search?.get("id");
    if (fromUrl && agents.some((a) => a.id === fromUrl)) setSelectedId(fromUrl);
    else if (!selectedId && agents.length) setSelectedId(agents[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, search]);

  const agent = useMemo(() => agents.find((a) => a.id === selectedId) ?? null, [agents, selectedId]);
  const providerCfg = agent ? hub?.prefs.aiProviders?.[agent.provider] : undefined;
  const hasKey = Boolean(providerCfg?.apiKey);

  // Load the selected agent's conversation.
  useEffect(() => {
    if (!user || !agent) return;
    setMessages([]);
    setChatError(null);
    getConversation(user.uid, agent.id).then(setMessages).catch(() => setMessages([]));
  }, [user, agent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function send() {
    if (!user || !agent || !hub || !input.trim() || thinking || !providerCfg?.apiKey) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim(), at: Date.now() };
    const history = messages.slice(-12);
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);
    setChatError(null);
    const r = await callAgentModel({
      provider: agent.provider,
      model: agent.model || providerCfg.model || PROVIDER_META[agent.provider].defaultModel,
      apiKey: providerCfg.apiKey,
      systemPrompt: renderPrompt(agent, hub.data),
      history,
      userMessage: userMsg.content,
    });
    setThinking(false);
    if (r.ok && r.text) {
      const reply: ChatMessage = { role: "assistant", content: r.text, at: Date.now() };
      const next = [...messages, userMsg, reply];
      setMessages(next);
      void saveConversation(user.uid, agent.id, next);
    } else {
      setChatError(r.error ?? "Something went wrong.");
      setMessages((m) => m.slice(0, -1));
      setInput(userMsg.content);
    }
  }

  async function clearChat() {
    if (!user || !agent) return;
    setClearing(false);
    setMessages([]);
    await saveConversation(user.uid, agent.id, []);
  }

  async function saveAgent(inputData: HubAgentInput) {
    if (!user) return;
    if (editing && !editing.id.startsWith("default-")) {
      await updateHubAgent(editing.id, inputData);
    } else {
      const id = await createHubAgent(user.uid, inputData);
      setSelectedId(id);
    }
    setEditorOpen(false);
    setEditing(null);
    await load();
  }

  async function removeAgent() {
    if (!user || !deleting) return;
    const wasSelected = deleting.id === selectedId;
    await deleteHubAgent(user.uid, deleting.id);
    setDeleting(null);
    if (wasSelected) setSelectedId(null);
    await load();
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><Bot className="h-6 w-6 text-primary" /> Agents</h1>
          <p className="text-muted-foreground">Chats that already know your data — grounded in live context.</p>
        </div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus className="h-4 w-4" /> New agent</Button>
      </div>

      {loading || !hub ? (
        <div className="space-y-3"><SkeletonCard lines={6} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          {/* Agent list */}
          <div className="space-y-1.5">
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                  a.id === selectedId ? "border-primary bg-primary/5" : "border-input hover:bg-accent"
                )}
              >
                <span className="text-xl">{a.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{HUB_MODULES[a.module].label} · {PROVIDER_META[a.provider].label.split(" ")[0]}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Chat */}
          {agent ? (
            <Card className="flex min-h-[520px] flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
                <span className="text-lg">{agent.icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{agent.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Clear chat" onClick={() => setClearing(true)} disabled={messages.length === 0}><RotateCcw className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Edit agent" onClick={() => { setEditing(agent); setEditorOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                {!agent.id.startsWith("default-") && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Delete agent" onClick={() => setDeleting(agent)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && !thinking && (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <p className="text-3xl">{agent.icon}</p>
                    <p className="mt-2">Ask anything about your {HUB_MODULES[agent.module].label.toLowerCase()} — live data is injected automatically.</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
                    {m.content}
                  </div>
                ))}
                {thinking && (
                  <div className="flex w-fit items-center gap-2 rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t p-3">
                {!hasKey ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                    No {PROVIDER_META[agent.provider].label} API key yet — add one in{" "}
                    <Link href="/settings" className="underline">Settings → AI providers</Link>.
                  </p>
                ) : (
                  <>
                    {chatError && <p className="mb-2 text-xs text-destructive">{chatError}</p>}
                    <form
                      className="flex items-end gap-2"
                      onSubmit={(e) => { e.preventDefault(); void send(); }}
                    >
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                        placeholder={`Message ${agent.name}…`}
                        rows={2}
                        className="flex-1 resize-none"
                      />
                      <Button type="submit" size="icon" disabled={!input.trim() || thinking} aria-label="Send"><Send className="h-4 w-4" /></Button>
                    </form>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card className="flex items-center justify-center p-10 text-sm text-muted-foreground">Pick an agent to start chatting.</Card>
          )}
        </div>
      )}

      {user && (
        <AgentEditorDialog
          open={editorOpen}
          onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}
          agent={editing}
          onSave={saveAgent}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this agent?"
        description="Its chat history is deleted too."
        onConfirm={removeAgent}
      />
      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title="Clear this chat?"
        description="The conversation history will be removed."
        confirmLabel="Clear"
        onConfirm={clearChat}
      />
    </div>
  );
}

function AgentEditorDialog({ open, onOpenChange, agent, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agent: HubAgent | null;
  onSave: (input: HubAgentInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [module, setModule] = useState<HubModule>("general");
  const [provider, setProvider] = useState<AIProviderType>("anthropic");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(agent?.name ?? "");
    setIcon(agent?.icon ?? "🤖");
    setModule(agent?.module ?? "general");
    setProvider(agent?.provider ?? "anthropic");
    setModel(agent?.model ?? "");
    setPrompt(agent?.systemPrompt || BASE_PROMPT);
  }, [open, agent]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), icon: icon.trim() || "🤖", module, provider, model: model.trim(), systemPrompt: prompt.trim() || BASE_PROMPT });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent && !agent.id.startsWith("default-") ? "Edit agent" : agent ? `Customize ${agent.name}` : "New agent"}</DialogTitle>
          <DialogDescription>Name it, pick its module and AI provider, and tune its prompt — no code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[64px_1fr] gap-2">
            <div className="space-y-1"><Label className="text-xs">Icon</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} className="text-center" /></div>
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wardrobe Agent" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Module (context source)</Label>
              <Select value={module} onValueChange={(v) => setModule(v as HubModule)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(HUB_MODULES).map(([k, m]) => <SelectItem key={k} value={k}>{m.icon} {m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">AI provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as AIProviderType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Model (blank = provider default)</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={PROVIDER_META[provider].defaultModel} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">System prompt — {"{{context}}"} is replaced with live data</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} className="font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save agent"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={8} />}>
      <AgentsInner />
    </Suspense>
  );
}
