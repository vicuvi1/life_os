"use client";

import { useEffect, useState } from "react";
import { Send, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { getPrefs, upsertPrefs } from "@/lib/firebase/db";
import { tgGetMe, tgDetectChatId, tgSend } from "@/lib/telegram";
import type { TelegramConfig } from "@/lib/types";

type Status = { kind: "idle" | "ok" | "error" | "busy"; msg?: string };

export function TelegramCard() {
  const { user } = useAuth();
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [onSleepLog, setOnSleepLog] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPrefs(user.uid).then((p) => {
      const t = p.telegram;
      if (t) {
        setToken(t.botToken);
        setChatId(t.chatId);
        setEnabled(t.enabled);
        setOnSleepLog(t.onSleepLog);
        setUsername(t.botToken ? "saved" : null);
      }
      setLoaded(true);
    });
  }, [user]);

  const connected = Boolean(token && chatId && enabled);

  async function persist(next: Partial<TelegramConfig>) {
    if (!user) return;
    const cfg: TelegramConfig = { botToken: token.trim(), chatId: chatId.trim(), enabled, onSleepLog, ...next };
    await upsertPrefs(user.uid, { telegram: cfg });
  }

  async function checkToken() {
    setStatus({ kind: "busy" });
    const r = await tgGetMe(token);
    if (r.ok) {
      setUsername(r.username ?? null);
      setStatus({ kind: "ok", msg: `Found @${r.username}. Now send it a message and tap Detect.` });
      await persist({});
    } else {
      setUsername(null);
      setStatus({ kind: "error", msg: r.error });
    }
  }

  async function detect() {
    setStatus({ kind: "busy" });
    const r = await tgDetectChatId(token);
    if (r.ok && r.chatId) {
      setChatId(r.chatId);
      setStatus({ kind: "ok", msg: `Linked to ${r.name ?? "your chat"}.` });
      await persist({ chatId: r.chatId });
    } else {
      setStatus({ kind: "error", msg: r.error });
    }
  }

  async function test() {
    setStatus({ kind: "busy" });
    const r = await tgSend(token, chatId, "✅ <b>Life OS connected!</b>\nYou'll get your notifications right here.");
    setStatus(r.ok ? { kind: "ok", msg: "Test message sent — check Telegram." } : { kind: "error", msg: r.error });
  }

  async function toggleEnabled(v: boolean) {
    setEnabled(v);
    await persist({ enabled: v });
  }
  async function toggleOnSleepLog(v: boolean) {
    setOnSleepLog(v);
    await persist({ onSleepLog: v });
  }
  async function disconnect() {
    setToken(""); setChatId(""); setUsername(null); setEnabled(false);
    if (user) await upsertPrefs(user.uid, { telegram: null });
    setStatus({ kind: "idle" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4 text-sky-500" /> Telegram notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Get Life OS notifications on your phone via Telegram. Create a bot with{" "}
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary hover:underline">@BotFather</a>,
          paste its token, message your bot once, then detect your chat.
        </p>

        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="tg-token" className="flex items-center gap-2">
                Bot token
                {username && username !== "saved" && <Badge variant="success">@{username}</Badge>}
              </Label>
              <div className="flex gap-2">
                <Input id="tg-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-DEF…" className="flex-1" type="password" />
                <Button variant="outline" onClick={checkToken} disabled={!token.trim() || status.kind === "busy"}>Check</Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tg-chat">Chat ID</Label>
              <div className="flex gap-2">
                <Input id="tg-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Auto-detected after you message the bot" className="flex-1" />
                <Button variant="outline" onClick={detect} disabled={!token.trim() || status.kind === "busy"}>Detect</Button>
              </div>
            </div>

            {status.kind !== "idle" && (
              <p className={
                status.kind === "error" ? "text-sm text-destructive"
                : status.kind === "ok" ? "text-sm text-emerald-600 dark:text-emerald-400"
                : "flex items-center gap-1.5 text-sm text-muted-foreground"
              }>
                {status.kind === "busy" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {status.msg}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={test} disabled={!token.trim() || !chatId.trim() || status.kind === "busy"}>
                <Send className="h-3.5 w-3.5" /> Send test
              </Button>
              {connected && <Badge variant="success"><Check className="mr-1 h-3 w-3" /> Connected</Badge>}
              <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={disconnect}>Disconnect</Button>
            </div>

            <div className="space-y-2 border-t pt-3">
              <ToggleRow label="Enable Telegram notifications" checked={enabled} disabled={!token.trim() || !chatId.trim()} onChange={toggleEnabled} />
              <ToggleRow label="Send a summary when I log sleep" checked={onSleepLog} disabled={!enabled} onChange={toggleOnSleepLog} />
            </div>

            <p className="rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              Notifications send while the app sends them (logging sleep, test, or the “Send to Telegram” buttons). Scheduled reminders while the app is closed need a small server component — coming next.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center justify-between gap-3 text-sm ${disabled ? "opacity-50" : ""}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
    </label>
  );
}
