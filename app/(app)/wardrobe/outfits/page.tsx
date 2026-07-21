"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Plus,
  Shirt,
  Heart,
  Star,
  Check,
  Copy,
  Share2,
  Pencil,
  Trash2,
  MoreVertical,
  Layers,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getWardrobe,
  updateOutfit,
  deleteOutfit,
  createOutfit,
  setWearForDay,
  type WardrobeData,
} from "@/lib/firebase/db";
import { outfitItems } from "@/lib/wardrobe";
import { toDateKey } from "@/lib/greeting";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OutfitBuilderDialog } from "@/components/wardrobe/outfit-builder-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { ClothingItem, Outfit } from "@/lib/types";

type Tab = "all" | "templates" | "favorites";

function Stars({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(value === n ? null : n);
          }}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={cn(!onChange && "cursor-default")}
        >
          <Star className={cn("h-3.5 w-3.5", (value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
        </button>
      ))}
    </span>
  );
}

function OutfitsInner() {
  const { user } = useAuth();
  const search = useSearchParams();
  const [data, setData] = useState<WardrobeData>({ items: [], outfits: [], wears: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Outfit | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Outfit | null>(null);
  const [shared, setShared] = useState(false);

  const today = toDateKey(new Date());

  useEffect(() => {
    const t = search?.get("type");
    if (t === "template") setTab("templates");
    else if (t === "favorites") setTab("favorites");
    const occ = search?.get("occasion");
    if (occ) setOccasion(occ);
  }, [search]);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      setData(await getWardrobe(user.uid));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const occasionsInUse = useMemo(() => {
    const set = new Set<string>();
    for (const o of data.outfits) for (const t of o.occasions) set.add(t);
    return Array.from(set).sort();
  }, [data.outfits]);

  // Clear a stale occasion filter (e.g. a bookmarked ?occasion= no outfit uses
  // anymore) once data has loaded, so it can never become an invisible filter.
  useEffect(() => {
    if (!loading && occasion && !occasionsInUse.includes(occasion)) setOccasion(null);
  }, [loading, occasion, occasionsInUse]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.outfits.filter((o) => {
      if (tab === "templates" && o.type !== "template") return false;
      if (tab === "favorites" && !o.favorite) return false;
      if (occasion && !o.occasions.includes(occasion)) return false;
      if (q && !`${o.name} ${o.occasions.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.outfits, tab, occasion, query]);

  const detail = useMemo(() => data.outfits.find((o) => o.id === detailId) ?? null, [data.outfits, detailId]);

  function patchOutfit(o: Outfit, patch: Partial<Outfit>) {
    setData((prev) => ({ ...prev, outfits: prev.outfits.map((x) => (x.id === o.id ? { ...x, ...patch } : x)) }));
    void updateOutfit(o.id, patch).catch(() => void load({ quiet: true }));
  }

  async function wearToday(o: Outfit): Promise<boolean> {
    if (!user) return false;
    const wearItems = outfitItems(o, data.items).filter((i) => !i.retired);
    if (wearItems.length === 0) return false;
    // Reconcile against whatever was already confirmed for today (no double-count).
    const existing = data.wears.find((w) => w.date === today);
    const prevConfirmed = existing && !existing.planned ? existing : null;
    const byId = new Map(data.items.map((i) => [i.id, i]));
    const prevItems = prevConfirmed
      ? prevConfirmed.itemIds
          .map((id) => byId.get(id))
          .filter((i): i is ClothingItem => Boolean(i))
          .map((i) => ({ id: i.id, timesWorn: i.timesWorn }))
      : [];
    const prevOutfit =
      prevConfirmed?.outfitId != null
        ? (() => {
            const p = data.outfits.find((x) => x.id === prevConfirmed.outfitId);
            return p ? { id: p.id, timesWorn: p.timesWorn } : null;
          })()
        : null;
    await setWearForDay({
      userId: user.uid,
      date: today,
      kind: "confirm",
      chosen: wearItems.map((i) => ({ id: i.id, timesWorn: i.timesWorn, lastWorn: i.lastWorn })),
      outfit: { id: o.id, timesWorn: o.timesWorn, lastWorn: o.lastWorn },
      prevItems,
      prevOutfit,
    });
    await load({ quiet: true });
    return true;
  }

  async function duplicate(o: Outfit) {
    if (!user) return;
    await createOutfit(user.uid, {
      name: `${o.name} (copy)`,
      type: o.type,
      itemIds: o.itemIds,
      occasions: o.occasions,
      rating: null,
      weatherFit: o.weatherFit,
      notes: o.notes,
      favorite: false,
    });
    await load({ quiet: true });
  }

  async function share(o: Outfit) {
    const names = outfitItems(o, data.items).map((i) => i.name);
    const text = `${o.name}${o.occasions.length ? ` (${o.occasions.join(", ")})` : ""}: ${names.join(", ")}`;
    try {
      if (navigator.share) await navigator.share({ title: o.name, text });
      else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        window.setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // user cancelled — fine
    }
  }

  const renderMenu = (o: Outfit) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Outfit menu" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          disabled={outfitItems(o, data.items).filter((i) => !i.retired).length === 0}
          onClick={() => void wearToday(o)}
        >
          <Check className="h-4 w-4" /> Wear today
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setEditing(o); setBuilderOpen(true); }}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => duplicate(o)}><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
        <DropdownMenuItem onClick={() => share(o)}><Share2 className="h-4 w-4" /> Share</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDeleting(o)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/wardrobe" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Wardrobe
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Layers className="h-6 w-6 text-primary" /> Outfits
          </h1>
          <p className="text-muted-foreground">Saved combinations — templates are your reusable go-tos.</p>
        </div>
        <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}>
          <Plus className="h-4 w-4" /> New outfit
        </Button>
      </div>

      {shared && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          Copied to clipboard!
        </div>
      )}

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-muted p-1">
          {(["all", "templates", "favorites"] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize transition", tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t === "all" ? "All outfits" : t}
            </button>
          ))}
        </div>
        <Input placeholder="Search outfits…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 min-w-[140px] flex-1" />
      </div>
      {occasionsInUse.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setOccasion(null)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", occasion == null ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>All occasions</button>
          {occasionsInUse.map((t) => (
            <button key={t} type="button" onClick={() => setOccasion(occasion === t ? null : t)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", occasion === t ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>{t}</button>
          ))}
        </div>
      )}

      {loading ? (
        <SkeletonCard lines={8} />
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{data.outfits.length === 0 ? "No outfits yet" : "Nothing matches this filter"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {data.outfits.length === 0
              ? "Combine items into outfits once — then mornings are a single tap."
              : "Try a different tab, occasion, or search."}
          </p>
          {data.outfits.length === 0 && (
            <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}>
              <Plus className="h-4 w-4" /> Create your first outfit
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((o) => {
            const its = outfitItems(o, data.items);
            return (
              <button key={o.id} type="button" onClick={() => setDetailId(o.id)} className="text-left">
                <Card className="card-interactive h-full overflow-hidden">
                  <div className="flex gap-1 bg-muted/20 p-2">
                    {its.slice(0, 4).map((i) => (
                      <div key={i.id} className="aspect-square w-1/4 overflow-hidden rounded-lg border bg-muted/40">
                        {i.imageData ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.imageData} alt={i.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Shirt className="h-5 w-5 text-muted-foreground/40" /></div>
                        )}
                      </div>
                    ))}
                    {its.length === 0 && (
                      <div className="flex aspect-square w-1/4 items-center justify-center rounded-lg border bg-muted/40"><Shirt className="h-5 w-5 text-muted-foreground/40" /></div>
                    )}
                  </div>
                  <div className="space-y-1.5 p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{o.name}</p>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", o.type === "template" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>{o.type}</span>
                      <button
                        type="button"
                        aria-label="Toggle favorite"
                        onClick={(e) => { e.stopPropagation(); patchOutfit(o, { favorite: !o.favorite }); }}
                        className={cn(o.favorite ? "text-rose-500" : "text-muted-foreground/40 hover:text-rose-400")}
                      >
                        <Heart className={cn("h-3.5 w-3.5", o.favorite && "fill-current")} />
                      </button>
                      {renderMenu(o)}
                    </div>
                    {o.occasions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {o.occasions.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Stars value={o.rating} />
                      <span className="tabular-nums">{o.timesWorn}× {o.lastWorn ? `· ${o.lastWorn}` : ""}</span>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(o) => { if (!o) setDetailId(null); }}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.name}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", detail.type === "template" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>{detail.type}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {outfitItems(detail, data.items).map((i) => (
                    <Link key={i.id} href={`/wardrobe/item/${i.id}`} className="block">
                      <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/40">
                        {i.imageData ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.imageData} alt={i.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Shirt className="h-6 w-6 text-muted-foreground/40" /></div>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[11px] font-medium">{i.name}</p>
                    </Link>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border bg-background/60 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Times worn</p>
                    <p className="font-bold tabular-nums">{detail.timesWorn}</p>
                  </div>
                  <div className="rounded-lg border bg-background/60 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last worn</p>
                    <p className="font-bold tabular-nums">{detail.lastWorn ?? "never"}</p>
                  </div>
                  <div className="rounded-lg border bg-background/60 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Weather fit</p>
                    <p className="font-medium">{detail.weatherFit ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border bg-background/60 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your rating</p>
                    <Stars value={detail.rating} onChange={(v) => patchOutfit(detail, { rating: v })} />
                  </div>
                </div>

                {detail.occasions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.occasions.map((t) => <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}
                  </div>
                )}

                {detail.notes && <p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">{detail.notes}</p>}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={outfitItems(detail, data.items).filter((i) => !i.retired).length === 0}
                    onClick={async () => { const ok = await wearToday(detail); if (ok) setDetailId(null); }}
                  >
                    <Check className="h-4 w-4" /> Wear today
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(detail); setBuilderOpen(true); setDetailId(null); }}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => { void duplicate(detail); setDetailId(null); }}><Copy className="h-4 w-4" /> Duplicate</Button>
                  <Button size="sm" variant="outline" onClick={() => share(detail)}><Share2 className="h-4 w-4" /> Share</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(detail); setDetailId(null); }}><Trash2 className="h-4 w-4" /> Delete</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {user && (
        <OutfitBuilderDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          userId={user.uid}
          items={data.items}
          outfit={editing}
          onSaved={() => load({ quiet: true })}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this outfit?"
        description="The items themselves are untouched — only the saved combination is removed."
        onConfirm={async () => {
          if (deleting) {
            await deleteOutfit(deleting.id);
            setDeleting(null);
            await load({ quiet: true });
          }
        }}
      />
    </div>
  );
}

export default function OutfitsPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={8} />}>
      <OutfitsInner />
    </Suspense>
  );
}
