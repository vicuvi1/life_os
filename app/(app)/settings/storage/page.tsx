"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Database,
  RefreshCw,
  Download,
  Trash2,
  Activity,
  Clock,
  Lock,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/expenses/confirm-dialog";
import {
  getPrefs,
  setStorageConfig,
  scanUsage,
  deleteDocsByIds,
} from "@/lib/firebase/db";
import {
  FREE_TIER_BYTES,
  OVERAGE_PER_GIB_MONTH,
  RETENTION_TARGETS,
  retentionTarget,
  mergePolicies,
  idsBefore,
  cutoffDateKey,
  estimateDocBytes,
  estimateGrowth,
  monthsToFreeTier,
  formatBytes,
  type UsageScan,
} from "@/lib/storage";
import type { RetentionPolicy, StorageConfig, StorageSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_MIN_GAP_MS = 12 * 60 * 60 * 1000;

type ConfirmState = { title: string; description: string; confirmLabel: string; run: () => Promise<void> } | null;
type Deletion = { collection: string; ids: string[] };

/** Remove deleted docs from a scan in place (avoids a full re-read after cleanup). */
function pruneScan(prev: UsageScan | null, dels: Deletion[]): UsageScan | null {
  if (!prev || dels.length === 0) return prev;
  const removed = new Map<string, Set<string>>();
  for (const d of dels) {
    const set = removed.get(d.collection) ?? new Set<string>();
    d.ids.forEach((id) => set.add(id));
    removed.set(d.collection, set);
  }
  const raw = { ...prev.raw };
  const collections = prev.collections.map((c) => {
    const rem = removed.get(c.name);
    if (!rem || rem.size === 0) return c;
    const kept = (raw[c.name] ?? []).filter((docItem) => !rem.has(docItem.id));
    raw[c.name] = kept;
    const bytes = kept.reduce((s, docItem) => s + estimateDocBytes(docItem.id, docItem.data), 0);
    return { ...c, count: kept.length, bytes };
  });
  const totalBytes = collections.reduce((s, c) => s + c.bytes, 0);
  const totalDocs = collections.reduce((s, c) => s + c.count, 0);
  return { ...prev, totalBytes, totalDocs, collections, raw };
}

export default function StoragePage() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);

  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [scan, setScan] = useState<UsageScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [scanMs, setScanMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [manualCollection, setManualCollection] = useState<string>("all");
  const [manualDate, setManualDate] = useState<string>(cutoffDateKey(now, 90));

  const persist = useCallback(
    async (cfg: StorageConfig) => {
      if (!user) return;
      try {
        await setStorageConfig(user.uid, cfg);
      } catch {
        // best-effort; local state still reflects the change
      }
    },
    [user]
  );

  // Read the whole footprint. Records a snapshot at most every ~12h.
  const doScan = useCallback(
    async (cfg: StorageConfig | null): Promise<{ scan: UsageScan | null; cfg: StorageConfig | null }> => {
      if (!user) return { scan: null, cfg };
      setScanning(true);
      setScanError(false);
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        const s = await scanUsage(user.uid);
        setScanMs(Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0));
        setScan(s);
        // Record a snapshot at most every ~12h, merging into the LATEST config
        // (not the captured `cfg`) so a concurrent policy edit can't be clobbered.
        setConfig((cur) => {
          const base = cur ?? cfg;
          if (!base) return base;
          const last = base.snapshots[base.snapshots.length - 1];
          if (last && s.at - last.at <= SNAPSHOT_MIN_GAP_MS) return base;
          const byCollection: Record<string, number> = {};
          for (const c of s.collections) byCollection[c.name] = c.bytes;
          const snapshot: StorageSnapshot = { at: s.at, totalBytes: s.totalBytes, docCount: s.totalDocs, byCollection };
          const merged = { ...base, snapshots: [...base.snapshots, snapshot].slice(-30) };
          void persist(merged);
          return merged;
        });
        return { scan: s, cfg };
      } catch {
        setScanError(true);
        return { scan: null, cfg };
      } finally {
        setScanning(false);
      }
    },
    [user, persist]
  );

  // Delete docs older than each enabled policy's window (once/day guard).
  const runAutoCleanup = useCallback(
    async (cfg: StorageConfig, s: UsageScan): Promise<{ deleted: number; dels: Deletion[] }> => {
      const policies = [...cfg.policies];
      let deleted = 0;
      const dels: Deletion[] = [];
      for (let i = 0; i < policies.length; i++) {
        const p = policies[i];
        if (!p.enabled) continue;
        if (p.lastRun && now.getTime() - p.lastRun < DAY_MS) continue;
        const target = retentionTarget(p.collection);
        if (!target) continue; // only ever the safe, log-like collections
        const old = idsBefore(s.raw[p.collection] ?? [], target.dateField, cutoffDateKey(now, p.days));
        if (old.length > 0) {
          const ids = old.map((d) => d.id);
          await deleteDocsByIds(p.collection, ids);
          deleted += ids.length;
          dels.push({ collection: p.collection, ids });
        }
        policies[i] = { ...p, lastRun: now.getTime() };
      }
      // Merge into the latest config so a snapshot recorded by doScan survives.
      setConfig((cur) => {
        const base = cur ?? cfg;
        const next = { ...base, policies };
        void persist(next);
        return next;
      });
      return { deleted, dels };
    },
    [now, persist]
  );

  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current || !user) return;
    initedRef.current = true;
    void (async () => {
      const prefs = await getPrefs(user.uid);
      const cfg: StorageConfig = {
        policies: mergePolicies(prefs.storage?.policies),
        snapshots: Array.isArray(prefs.storage?.snapshots) ? prefs.storage!.snapshots : [],
        autoCleanup: prefs.storage?.autoCleanup === true,
      };
      setConfig(cfg);
      const { scan: s, cfg: cfg2 } = await doScan(cfg);
      if (s && cfg2?.autoCleanup) {
        const { deleted, dels } = await runAutoCleanup(cfg2, s);
        if (deleted > 0) {
          setAutoMsg(`Auto-cleanup removed ${deleted} old record${deleted === 1 ? "" : "s"}.`);
          setScan((prev) => pruneScan(prev, dels));
        }
      }
    })();
  }, [user, doScan, runAutoCleanup]);

  const updatePolicy = useCallback(
    (collection: string, patch: Partial<RetentionPolicy>) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = { ...prev, policies: prev.policies.map((p) => (p.collection === collection ? { ...p, ...patch } : p)) };
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  const setAutoCleanup = useCallback(
    (on: boolean) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = { ...prev, autoCleanup: on };
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  // Preview (count + bytes) of what a policy/date would delete, from the last scan.
  const oldForPolicy = useCallback(
    (collectionName: string, dateField: string, days: number) => {
      const docs = scan?.raw[collectionName] ?? [];
      const old = idsBefore(docs, dateField, cutoffDateKey(now, days));
      const bytes = old.reduce((sum, d) => sum + estimateDocBytes(d.id, d.data), 0);
      return { ids: old.map((d) => d.id), count: old.length, bytes };
    },
    [scan, now]
  );

  async function runCleanup(collectionName: string, ids: string[]) {
    if (!user || ids.length === 0) return;
    setBusy(true);
    try {
      await deleteDocsByIds(collectionName, ids);
      updatePolicy(collectionName, { lastRun: Date.now() });
      setScan((prev) => pruneScan(prev, [{ collection: collectionName, ids }]));
    } finally {
      setBusy(false);
    }
  }

  // Manual cleanup preview across the selected safe collection(s) before a date.
  const manualPreview = useMemo(() => {
    if (!scan) return [];
    const targets = manualCollection === "all" ? RETENTION_TARGETS : RETENTION_TARGETS.filter((t) => t.collection === manualCollection);
    return targets
      .map((t) => {
        const old = idsBefore(scan.raw[t.collection] ?? [], t.dateField, manualDate);
        const bytes = old.reduce((sum, d) => sum + estimateDocBytes(d.id, d.data), 0);
        return { target: t, ids: old.map((d) => d.id), count: old.length, bytes };
      })
      .filter((r) => r.count > 0);
  }, [scan, manualCollection, manualDate]);

  const manualTotal = useMemo(
    () => manualPreview.reduce((a, r) => ({ count: a.count + r.count, bytes: a.bytes + r.bytes }), { count: 0, bytes: 0 }),
    [manualPreview]
  );

  async function runManualCleanup() {
    if (!user) return;
    setBusy(true);
    try {
      const dels: Deletion[] = [];
      for (const r of manualPreview) {
        if (r.ids.length > 0) {
          await deleteDocsByIds(r.target.collection, r.ids);
          dels.push({ collection: r.target.collection, ids: r.ids });
        }
      }
      setScan((prev) => pruneScan(prev, dels));
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    if (!scan) return;
    const out = { exportedAt: new Date(scan.at).toISOString(), collections: scan.raw };
    const replacer = (_key: string, value: unknown) => {
      if (value && typeof value === "object" && typeof (value as { toMillis?: unknown }).toMillis === "function") {
        return (value as { toMillis: () => number }).toMillis();
      }
      return value;
    };
    const blob = new Blob([JSON.stringify(out, replacer, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-os-backup-${cutoffDateKey(new Date(scan.at), 0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- derived ----------------------------------------------------------------
  const total = scan?.totalBytes ?? 0;
  const usagePct = Math.min(100, (total / FREE_TIER_BYTES) * 100);
  const growth = useMemo(() => estimateGrowth(config?.snapshots ?? []), [config]);
  const monthsToFull = monthsToFreeTier(total, growth.perMonth);
  const maxCollectionBytes = scan ? Math.max(1, ...scan.collections.map((c) => c.bytes)) : 1;
  const policiesEnabled = (config?.policies ?? []).filter((p) => p.enabled);
  const enabledDue = policiesEnabled
    .map((p) => {
      const t = retentionTarget(p.collection);
      return t ? oldForPolicy(p.collection, t.dateField, p.days) : { count: 0, bytes: 0, ids: [] };
    })
    .reduce((a, r) => ({ count: a.count + r.count, bytes: a.bytes + r.bytes }), { count: 0, bytes: 0 });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/settings" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <Database className="h-6 w-6 text-primary" /> Storage &amp; Data
            </h1>
            <p className="text-muted-foreground">Keep Life OS lean and free to run — for years.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => doScan(config)} disabled={scanning}>
              <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} /> {scanning ? "Scanning…" : "Scan now"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson} disabled={!scan}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>
      </div>

      {autoMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {autoMsg}
        </div>
      )}

      {/* honesty note */}
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        These figures are an <strong>estimate of your own document data</strong> (Firestore doesn&apos;t expose exact
        billed storage to the app, and billed size is higher because it includes indexes). This app has no server, so
        cleanup runs when you open this page — there is no overnight cron or automatic backup. Use <strong>Export</strong>
        {" "}to save a real copy of your data.
      </p>

      {/* Storage summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Storage footprint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scanError ? (
            <p className="text-sm text-destructive">Couldn&apos;t read your data. Check your connection and try Scan again.</p>
          ) : !scan ? (
            <p className="text-sm text-muted-foreground">{scanning ? "Measuring your data…" : "Run a scan to measure your footprint."}</p>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums">{formatBytes(total)}</span>
                <span className="text-sm text-muted-foreground">of ~1 GiB free tier · {usagePct.toFixed(usagePct < 1 ? 2 : 1)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", usagePct < 70 ? "bg-emerald-500" : usagePct < 90 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${Math.max(1, usagePct)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">Documents</p><p className="font-semibold tabular-nums">{scan.totalDocs.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Collections</p><p className="font-semibold tabular-nums">{scan.collections.filter((c) => c.count > 0).length}</p></div>
                <div><p className="text-muted-foreground">Est. monthly cost</p><p className="font-semibold tabular-nums">{total <= FREE_TIER_BYTES ? "$0.00" : `$${(((total - FREE_TIER_BYTES) / FREE_TIER_BYTES) * OVERAGE_PER_GIB_MONTH).toFixed(2)}`}</p></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Collection breakdown */}
      {scan && scan.collections.some((c) => c.count > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {scan.collections.filter((c) => c.count > 0).map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    {c.protectedForever && <Lock className="h-3 w-3 text-muted-foreground" />}
                    {c.label}
                    <span className="text-xs text-muted-foreground">· {c.count.toLocaleString()}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBytes(c.bytes)} · {total > 0 ? Math.round((c.bytes / total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", c.protectedForever ? "bg-sky-500/70" : "bg-primary")} style={{ width: `${(c.bytes / maxCollectionBytes) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground"><Lock className="mr-1 inline h-3 w-3" />Locked collections are never auto-deleted (goals, tasks, finance, settings…).</p>
          </CardContent>
        </Card>
      )}

      {/* Retention policies */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Retention policies</CardTitle>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={config?.autoCleanup ?? false} onChange={(e) => setAutoCleanup(e.target.checked)} className="h-4 w-4 rounded border-input" />
              Auto-clean on open
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Trim old <strong>log-like</strong> data on a schedule. Only these disposable collections are eligible —
            nothing important is ever touched. Enable a policy, set how long to keep, and it&apos;ll be cleaned when you
            open this page (or run it now).
          </p>
          {(config?.policies ?? []).map((p) => {
            const t = retentionTarget(p.collection);
            if (!t) return null;
            const old = oldForPolicy(p.collection, t.dateField, p.days);
            return (
              <div key={p.collection} className={cn("rounded-lg border p-3", p.enabled && "border-primary/40 bg-primary/5")}>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={p.enabled} onChange={(e) => updatePolicy(p.collection, { enabled: e.target.checked })} className="h-4 w-4 rounded border-input" />
                    {t.label}
                  </label>
                  <div className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
                    Keep
                    <Input type="number" min={1} value={p.days} onChange={(e) => updatePolicy(p.collection, { days: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className="h-8 w-20" aria-label={`${t.label} days to keep`} />
                    days
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{t.reason}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={old.count > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {old.count > 0 ? `${old.count} record${old.count === 1 ? "" : "s"} older than ${p.days} days · ${formatBytes(old.bytes)}` : "Nothing older than the window"}
                    {p.lastRun ? ` · last run ${new Date(p.lastRun).toLocaleDateString()}` : ""}
                  </span>
                  {old.count > 0 && (
                    <Button size="sm" variant="outline" disabled={busy} className="h-7 px-2 text-xs"
                      onClick={() => setConfirm({
                        title: `Delete ${old.count} old ${t.label.toLowerCase()}?`,
                        description: `This permanently deletes ${old.count} record${old.count === 1 ? "" : "s"} older than ${p.days} days (~${formatBytes(old.bytes)}). This can't be undone.`,
                        confirmLabel: "Delete",
                        run: () => runCleanup(p.collection, old.ids),
                      })}>
                      <Trash2 className="h-3.5 w-3.5" /> Run now
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {policiesEnabled.length > 0 && enabledDue.count > 0 && (
            <Button variant="secondary" size="sm" disabled={busy}
              onClick={() => setConfirm({
                title: `Apply ${policiesEnabled.length} enabled ${policiesEnabled.length === 1 ? "policy" : "policies"}?`,
                description: `This permanently deletes ${enabledDue.count} old record${enabledDue.count === 1 ? "" : "s"} (~${formatBytes(enabledDue.bytes)}) across enabled policies. This can't be undone.`,
                confirmLabel: "Delete all",
                run: async () => {
                  const dels: Deletion[] = [];
                  for (const p of policiesEnabled) {
                    const t = retentionTarget(p.collection);
                    if (!t) continue;
                    const old = oldForPolicy(p.collection, t.dateField, p.days);
                    if (old.ids.length > 0) {
                      await deleteDocsByIds(p.collection, old.ids);
                      dels.push({ collection: p.collection, ids: old.ids });
                    }
                    updatePolicy(p.collection, { lastRun: Date.now() });
                  }
                  setScan((prev) => pruneScan(prev, dels));
                },
              })}>
              <Trash2 className="h-4 w-4" /> Apply enabled policies ({enabledDue.count})
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Manual cleanup */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Manual cleanup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Delete disposable log data older than a date. Protected data (goals, finance, tasks…) is never listed here.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Older than</label>
              <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="h-9 w-[170px]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Collection</label>
              <select value={manualCollection} onChange={(e) => setManualCollection(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="all">All disposable</option>
                {RETENTION_TARGETS.map((t) => <option key={t.collection} value={t.collection}>{t.label}</option>)}
              </select>
            </div>
          </div>
          {scan && (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              {manualPreview.length === 0 ? (
                <p className="text-muted-foreground">Nothing older than {manualDate} in the selected data.</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {manualPreview.map((r) => (
                      <li key={r.target.collection} className="flex justify-between">
                        <span>{r.target.label}</span>
                        <span className="tabular-nums text-muted-foreground">{r.count} · {formatBytes(r.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                    <span>Total to delete</span>
                    <span className="tabular-nums">{manualTotal.count} · {formatBytes(manualTotal.bytes)}</span>
                  </div>
                </>
              )}
            </div>
          )}
          <Button variant="destructive" size="sm" disabled={busy || manualTotal.count === 0}
            onClick={() => setConfirm({
              title: `Delete ${manualTotal.count} record${manualTotal.count === 1 ? "" : "s"}?`,
              description: `This permanently deletes everything older than ${manualDate} in the selected data (~${formatBytes(manualTotal.bytes)}). This can't be undone.`,
              confirmLabel: "Delete now",
              run: runManualCleanup,
            })}>
            <Trash2 className="h-4 w-4" /> Delete older than {manualDate}
          </Button>
        </CardContent>
      </Card>

      {/* Trend, growth & projection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Trend &amp; projection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(config?.snapshots.length ?? 0) < 2 ? (
            <p className="text-sm text-muted-foreground">Come back over time — each visit records a snapshot, and after a few you&apos;ll see your growth trend and a projection here.</p>
          ) : (
            <>
              <div className="flex h-24 items-end gap-1">
                {config!.snapshots.map((s) => {
                  const maxT = Math.max(...config!.snapshots.map((x) => x.totalBytes), 1);
                  return <div key={s.at} title={`${new Date(s.at).toLocaleDateString()}: ${formatBytes(s.totalBytes)}`} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(4, (s.totalBytes / maxT) * 100)}%` }} />;
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-muted-foreground">Growth</p><p className={cn("font-semibold tabular-nums", growth.perMonth > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>{growth.perMonth >= 0 ? "+" : "−"}{formatBytes(Math.abs(growth.perMonth))}/mo</p></div>
                <div><p className="text-muted-foreground">Hit 1 GiB in</p><p className="font-semibold tabular-nums">{monthsToFull == null ? "never at this rate" : `~${Math.round(monthsToFull)} mo`}</p></div>
                <div><p className="text-muted-foreground">Based on</p><p className="font-semibold tabular-nums">{config!.snapshots.length} snapshots</p></div>
              </div>
              {growth.perMonth > 0 && (
                <p className="text-xs text-muted-foreground">Projected without cleanup: ~{formatBytes(total + growth.perMonth * 3)} in 3 months, ~{formatBytes(total + growth.perMonth * 12)} in a year. Enabling retention flattens this.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Connection" ok={!scanError && !!scan} okText="Connected" badText="Unreachable" />
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Last scan latency</span><span className="tabular-nums">{scanMs == null ? "—" : `${scanMs} ms`}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Documents scanned</span><span className="tabular-nums">{scan ? scan.totalDocs.toLocaleString() : "—"}</span></div>
          <div className="flex items-start justify-between gap-3 border-t pt-2">
            <span className="flex items-center gap-2 text-muted-foreground"><ShieldAlert className="h-4 w-4 text-amber-500" /> Backups</span>
            <span className="text-right text-muted-foreground">Not automated (no server). Use <strong>Export</strong> to save a copy.</span>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.confirmLabel ?? "Confirm"}
        destructive
        onConfirm={() => { void confirm?.run(); }}
      />
    </div>
  );
}

function Row({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("flex items-center gap-1.5 font-medium", ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
        <span className={cn("h-2 w-2 rounded-full", ok ? "bg-emerald-500" : "bg-rose-500")} />
        {ok ? okText : badText}
      </span>
    </div>
  );
}
