"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { getPrefs, upsertPrefs } from "@/lib/firebase/db";
import { callAgentModel, PROVIDER_META } from "@/lib/ai";
import type { AIProviders, AIProviderType } from "@/lib/types";

const TYPES: AIProviderType[] = ["anthropic", "gemini"];

export function AIProvidersCard() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<AIProviders>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<AIProviderType | null>(null);
  const [status, setStatus] = useState<Partial<Record<AIProviderType, { ok: boolean; msg: string }>>>({});

  useEffect(() => {
    if (!user) return;
    getPrefs(user.uid).then((p) => {
      setProviders(p.aiProviders ?? {});
      setLoaded(true);
    });
  }, [user]);

  function patch(type: AIProviderType, p: Partial<{ apiKey: string; model: string }>) {
    setProviders((prev) => ({
      ...prev,
      [type]: { apiKey: prev[type]?.apiKey ?? "", model: prev[type]?.model ?? PROVIDER_META[type].defaultModel, ...p },
    }));
  }

  async function save(type: AIProviderType) {
    if (!user) return;
    const cfg = providers[type];
    if (!cfg) return;
    await upsertPrefs(user.uid, { aiProviders: { ...providers, [type]: cfg } });
    setStatus((s) => ({ ...s, [type]: { ok: true, msg: "Saved." } }));
  }

  async function test(type: AIProviderType) {
    const cfg = providers[type];
    if (!cfg?.apiKey) return;
    setBusy(type);
    const r = await callAgentModel({
      provider: type,
      model: cfg.model || PROVIDER_META[type].defaultModel,
      apiKey: cfg.apiKey,
      systemPrompt: "You are a connection test. Reply with exactly: ok",
      history: [],
      userMessage: "ping",
    });
    setBusy(null);
    setStatus((s) => ({ ...s, [type]: r.ok ? { ok: true, msg: "Connected — key works." } : { ok: false, msg: r.error ?? "Failed." } }));
    if (r.ok && user) await upsertPrefs(user.uid, { aiProviders: providers });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> AI providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Power the Agent Hub with your own API keys. Keys are stored in your private, owner-scoped
          settings and sent directly from your browser to the provider — never through any middleman server.
        </p>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          TYPES.map((type) => {
            const meta = PROVIDER_META[type];
            const cfg = providers[type];
            const st = status[type];
            return (
              <div key={type} className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{meta.label}</p>
                  {cfg?.apiKey && <Badge variant="success"><Check className="mr-1 h-3 w-3" /> Key saved</Badge>}
                  <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-primary hover:underline">Get a key</a>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                  <div className="space-y-1">
                    <Label htmlFor={`key-${type}`} className="text-xs">API key</Label>
                    <Input id={`key-${type}`} type="password" placeholder={meta.keyHint} value={cfg?.apiKey ?? ""} onChange={(e) => patch(type, { apiKey: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`model-${type}`} className="text-xs">Default model</Label>
                    <Input id={`model-${type}`} placeholder={meta.defaultModel} value={cfg?.model ?? ""} onChange={(e) => patch(type, { model: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => save(type)} disabled={!cfg?.apiKey}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => test(type)} disabled={!cfg?.apiKey || busy === type}>
                    {busy === type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Test"}
                  </Button>
                  {st && <span className={`text-xs ${st.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>{st.msg}</span>}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
