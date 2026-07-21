"use client";

import { Moon, Sun, Clock, Pencil, HeartPulse } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/dates";
import { formatHours, sleepScore, scoreMeta, timeInBedHours, recoveryScore, sleepDebt, qualityRating } from "@/lib/sleep";
import type { SleepLog, SleepMeta } from "@/lib/types";

const SCALE = ["😣", "😕", "😐", "🙂", "😄"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string | null;
  log: SleepLog | null;
  meta: SleepMeta | undefined;
  naps: SleepLog[];
  allSleep: SleepLog[];
  target: number;
  onEdit: (date: string) => void;
}

export function SleepDaySheet({ open, onOpenChange, date, log, meta, naps, allSleep, target, onEdit }: Props) {
  const score = log ? sleepScore(log, target) : 0;
  const sm = scoreMeta(score);
  const recovery = log ? recoveryScore(log, sleepDebt(allSleep, target, log.date, 7), target) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-0">
        {date && (
          <>
            <SheetHeader className="border-b px-5 py-4 pr-12">
              <SheetTitle>{formatLongDate(date)}</SheetTitle>
              <SheetDescription>{log ? "Night's sleep" : "No sleep logged"}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {log ? (
                <>
                  <div className="flex items-center gap-4 rounded-2xl border bg-muted/20 p-4">
                    <div className="relative h-16 w-16 shrink-0">
                      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                        <circle cx="32" cy="32" r="27" fill="none" strokeWidth="6" className="stroke-muted" />
                        <circle cx="32" cy="32" r="27" fill="none" strokeWidth="6" strokeLinecap="round" stroke={sm.color} strokeDasharray={2 * Math.PI * 27} strokeDashoffset={2 * Math.PI * 27 * (1 - score / 100)} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">{score}</span>
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums leading-none">{formatHours(log.hours)}</p>
                      <p className="mt-0.5 text-sm" style={{ color: sm.color }}>{sm.label}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    <Fact icon={<Moon className="h-3.5 w-3.5" />} label="Bedtime" value={log.bedtime ?? "—"} />
                    <Fact icon={<Sun className="h-3.5 w-3.5" />} label="Wake" value={log.wakeTime ?? "—"} />
                    <Fact icon={<Clock className="h-3.5 w-3.5" />} label="Time in bed" value={log.bedtime ? formatHours(timeInBedHours(log)) : "—"} />
                    <Fact icon={<HeartPulse className="h-3.5 w-3.5" />} label="Recovery" value={`${recovery} · ${scoreMeta(recovery).label}`} />
                    <Fact label="Quality" value={`${log.quality}/10 · ${qualityRating(log.quality).label}`} />
                    {naps.length > 0 && <Fact label="Naps" value={`${naps.length} · ${formatHours(naps.reduce((s, n) => s + n.hours, 0))}`} />}
                  </div>

                  {log.notes && <p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">{log.notes}</p>}
                </>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing recorded for this night.</p>
              )}

              {/* Morning check-in */}
              {meta && (meta.mood || meta.energy || meta.stress || meta.recoveryFeel || meta.checkinNotes) && (
                <div className="rounded-2xl border p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Morning check-in</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {meta.mood && <Fact label="Mood" value={meta.mood} />}
                    {meta.energy && <Fact label="Energy" value={SCALE[meta.energy - 1] ?? String(meta.energy)} />}
                    {meta.stress && <Fact label="Stress" value={SCALE[meta.stress - 1] ?? String(meta.stress)} />}
                    {meta.recoveryFeel && <Fact label="Felt recovered" value={SCALE[meta.recoveryFeel - 1] ?? String(meta.recoveryFeel)} />}
                  </div>
                  {meta.checkinNotes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{meta.checkinNotes}</p>}
                </div>
              )}
            </div>
            <div className="border-t p-4">
              <Button className="w-full" onClick={() => onEdit(date)}><Pencil className="h-4 w-4" /> {log ? "Edit this night" : "Log this night"}</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-2.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</p>
      <p className="mt-0.5 truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}
