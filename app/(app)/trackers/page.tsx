"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Archive,
  ArchiveRestore,
  Moon,
  GlassWater,
  Flame,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getTrackers,
  updateTracker,
  deleteTracker,
  getPrefs,
  upsertPrefs,
} from "@/lib/firebase/db";
import { trackerIcon, formatTrackerValue } from "@/lib/trackers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrackerFormDialog } from "@/components/trackers/tracker-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Tracker } from "@/lib/types";

/** Built-in trackers the user can hide from the daily flow. */
const BUILT_INS = [
  { key: "sleep", label: "Sleep", icon: Moon },
  { key: "water", label: "Water", icon: GlassWater },
  { key: "habits", label: "Habits", icon: Flame },
];

export default function TrackersPage() {
  const { user } = useAuth();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ open: boolean; tracker: Tracker | null }>({
    open: false,
    tracker: null,
  });
  const [deleting, setDeleting] = useState<Tracker | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [t, prefs] = await Promise.all([
        getTrackers(user.uid),
        getPrefs(user.uid),
      ]);
      setTrackers(t);
      setHidden(prefs.hiddenTrackers);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleHidden(key: string) {
    if (!user) return;
    const next = hidden.includes(key)
      ? hidden.filter((k) => k !== key)
      : [...hidden, key];
    setHidden(next);
    await upsertPrefs(user.uid, { hiddenTrackers: next });
  }

  async function move(tracker: Tracker, dir: -1 | 1) {
    const active = trackers.filter((t) => !t.archived);
    const idx = active.findIndex((t) => t.id === tracker.id);
    const swapWith = active[idx + dir];
    if (!swapWith) return;
    // Swap sort orders locally + persist both.
    const a = { ...tracker, sortOrder: swapWith.sortOrder };
    const b = { ...swapWith, sortOrder: tracker.sortOrder };
    setTrackers((prev) =>
      prev
        .map((t) => (t.id === a.id ? a : t.id === b.id ? b : t))
        .sort((x, y) => x.sortOrder - y.sortOrder || x.createdAt - y.createdAt)
    );
    await Promise.all([
      updateTracker(a.id, { sortOrder: a.sortOrder }),
      updateTracker(b.id, { sortOrder: b.sortOrder }),
    ]);
  }

  async function toggleArchived(tracker: Tracker) {
    setTrackers((prev) =>
      prev.map((t) =>
        t.id === tracker.id ? { ...t, archived: !t.archived } : t
      )
    );
    await updateTracker(tracker.id, { archived: !tracker.archived });
  }

  const active = trackers.filter((t) => !t.archived);
  const archived = trackers.filter((t) => t.archived);
  const nextSortOrder =
    trackers.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Trackers</h1>
          <p className="text-muted-foreground">
            Define your own metrics, and shape which trackers you see daily.
          </p>
        </div>
        {user && (
          <Button onClick={() => setForm({ open: true, tracker: null })}>
            <Plus className="h-4 w-4" /> New tracker
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Built-in trackers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Built-in trackers</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {BUILT_INS.map(({ key, label, icon: Icon }) => {
                const isHidden = hidden.includes(key);
                return (
                  <div key={key} className="flex items-center gap-3 px-5 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        isHidden && "text-muted-foreground line-through"
                      )}
                    >
                      {label}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHidden(key)}
                    >
                      {isHidden ? (
                        <>
                          <Eye className="h-4 w-4" /> Show
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4" /> Hide
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Custom trackers */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Your trackers ({active.length})
            </h2>
            {active.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <SlidersHorizontal className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">No custom trackers yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Track anything — focus score, job applications, weight —
                    with its own unit and daily target.
                  </p>
                  <Button onClick={() => setForm({ open: true, tracker: null })}>
                    <Plus className="h-4 w-4" /> Create a tracker
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {active.map((t, i) => {
                    const Icon = trackerIcon(t.icon);
                    return (
                      <div key={t.id} className="flex items-center gap-2 px-4 py-3">
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.type}
                            {t.target != null &&
                              ` · target ${formatTrackerValue(t, t.target)}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => move(t, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Move down"
                          disabled={i === active.length - 1}
                          onClick={() => move(t, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Archive"
                          onClick={() => toggleArchived(t)}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Edit"
                          onClick={() => setForm({ open: true, tracker: t })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Delete"
                          onClick={() => setDeleting(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </section>

          {/* Archived */}
          {archived.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Archived ({archived.length})
              </h2>
              <Card>
                <CardContent className="divide-y p-0">
                  {archived.map((t) => {
                    const Icon = trackerIcon(t.icon);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm text-muted-foreground">
                          {t.name}
                        </span>
                        <Badge variant="secondary">Archived</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleArchived(t)}
                        >
                          <ArchiveRestore className="h-4 w-4" /> Restore
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}

      {user && (
        <TrackerFormDialog
          open={form.open}
          onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}
          userId={user.uid}
          tracker={form.tracker}
          nextSortOrder={nextSortOrder}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this tracker?"
        description="This permanently deletes the tracker and its entire log history."
        onConfirm={async () => {
          if (deleting) {
            await deleteTracker(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}
