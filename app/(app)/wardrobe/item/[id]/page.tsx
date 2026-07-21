"use client";

import { SkeletonCard } from "@/components/ui/skeleton";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Heart,
  Pencil,
  Shirt,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  getWardrobe,
  updateClothing,
  deleteClothing,
  getBudget,
  type WardrobeData,
} from "@/lib/firebase/db";
import { STATUS_META, costPerWear, outfitItems } from "@/lib/wardrobe";
import { resolveCurrency, formatAmount, type Currency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusSelect } from "@/components/wardrobe/status-select";
import { ItemFormDialog } from "@/components/wardrobe/item-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { ClothingItem } from "@/lib/types";

type Tab = "outfits" | "history" | "notes" | "care";

export default function WardrobeItemPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const itemId = params?.id;

  const [data, setData] = useState<WardrobeData>({ items: [], outfits: [], wears: [] });
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [tab, setTab] = useState<Tab>("outfits");
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!user) return;
    if (!opts?.quiet) setLoading(true);
    try {
      const [w, b] = await Promise.all([getWardrobe(user.uid), getBudget(user.uid)]);
      setData(w);
      setCurrency(resolveCurrency(b));
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const item = useMemo(() => data.items.find((i) => i.id === itemId) ?? null, [data.items, itemId]);
  const photos = useMemo(() => (item ? [item.imageData, ...item.extraImages].filter((s): s is string => Boolean(s)) : []), [item]);
  // Keep the selected photo valid after an edit removes photos (avoids a blank main pane).
  useEffect(() => {
    if (photoIndex > 0 && photoIndex >= photos.length) setPhotoIndex(Math.max(0, photos.length - 1));
  }, [photos.length, photoIndex]);
  const inOutfits = useMemo(() => data.outfits.filter((o) => item && o.itemIds.includes(item.id)), [data.outfits, item]);
  const history = useMemo(
    () => data.wears.filter((w) => item && !w.planned && w.itemIds.includes(item.id)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.wears, item]
  );
  const cpw = item ? costPerWear(item) : null;

  function patch(patchData: Partial<ClothingItem>) {
    if (!item) return;
    setData((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, ...patchData } : i)) }));
    void updateClothing(item.id, patchData).catch(() => void load({ quiet: true }));
  }

  const fmt = (n: number) => (currency ? formatAmount(n, currency) : String(n));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/wardrobe" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Wardrobe
      </Link>

      {loading ? (
        <SkeletonCard lines={10} />
      ) : !item ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Shirt className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Item not found</p>
          <p className="text-sm text-muted-foreground">It may have been deleted.</p>
          <Button variant="outline" onClick={() => router.push("/wardrobe")}>Back to wardrobe</Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-[minmax(0,380px)_1fr]">
            {/* Photos */}
            <div className="space-y-2">
              <div className="aspect-square w-full overflow-hidden rounded-2xl border bg-muted/40">
                {photos[photoIndex] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[photoIndex]} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Shirt className="h-16 w-16 text-muted-foreground/30" /></div>
                )}
              </div>
              <div className="flex gap-2">
                {photos.map((p, i) => (
                  <button key={i} type="button" onClick={() => setPhotoIndex(i)} className={cn("h-16 w-16 overflow-hidden rounded-lg border transition", i === photoIndex && "ring-2 ring-primary")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
                <button type="button" onClick={() => setEditOpen(true)} className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground transition hover:bg-accent" title="Add photos (opens editor)">
                  +
                </button>
              </div>
            </div>

            {/* Meta */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h1 className="flex items-center gap-2 text-2xl font-bold">
                    {item.name}
                    <button type="button" onClick={() => patch({ favorite: !item.favorite })} aria-label="Toggle favorite" className={cn("transition", item.favorite ? "text-rose-500" : "text-muted-foreground/40 hover:text-rose-400")}>
                      <Heart className={cn("h-5 w-5", item.favorite && "fill-current")} />
                    </button>
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {item.category && <span>{item.category}</span>}
                    {item.brand && <span>· {item.brand}</span>}
                    {item.color && <span>· {item.color}</span>}
                    {item.size && <span>· {item.size}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => patch({ retired: !item.retired })}>
                    {item.retired ? <><ArchiveRestore className="h-4 w-4" /> Unretire</> : <><Archive className="h-4 w-4" /> Retire</>}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => setDeleting(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusSelect status={item.status} needsIroning={item.needsIroning} onChange={(p) => patch(p)} className="border-input bg-background" />
                {(item.seasons.length > 0 || item.styles.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {[...item.seasons, ...item.styles].map((t) => (
                      <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Times worn" value={String(item.timesWorn)} />
                <Metric label="Last worn" value={item.lastWorn ?? "never"} />
                <Metric label="Price" value={item.cost != null ? fmt(item.cost) : "—"} />
                <Metric label="Cost per wear" value={cpw != null ? fmt(cpw) : "—"} highlight={cpw != null} />
              </div>
              {item.purchaseDate && (
                <p className="text-xs text-muted-foreground">Purchased {item.purchaseDate}</p>
              )}
              {item.retired && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  Retired — hidden from the active wardrobe and outfit picking; history stays intact.
                </p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Card className="overflow-hidden">
            <div className="flex border-b bg-muted/30">
              {(["outfits", "history", "notes", "care"] as Tab[]).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={cn("px-4 py-2.5 text-sm font-medium capitalize transition", tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === "outfits" && (
                inOutfits.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">This item isn&apos;t part of any saved outfit yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {inOutfits.map((o) => (
                      <div key={o.id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{o.name}</p>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{o.type}</span>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          {outfitItems(o, data.items).slice(0, 6).map((i) =>
                            i.imageData ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i.id} src={i.imageData} alt={i.name} className="h-9 w-9 rounded-md border object-cover" />
                            ) : (
                              <span key={i.id} className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40"><Shirt className="h-4 w-4 text-muted-foreground/50" /></span>
                            )
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">worn {o.timesWorn}× {o.lastWorn ? `· last ${o.lastWorn}` : ""}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
              {tab === "history" && (
                history.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No wear history yet — confirm a wear from the overview.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {history.map((w) => (
                      <li key={w.id} className="flex items-center gap-3">
                        <span className="tabular-nums text-muted-foreground">{w.date}</span>
                        <span className="text-xs text-muted-foreground">{w.outfitId ? data.outfits.find((o) => o.id === w.outfitId)?.name ?? "" : ""}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
              {tab === "notes" && (
                <p className={cn("whitespace-pre-wrap text-sm", !item.notes && "py-8 text-center text-muted-foreground")}>
                  {item.notes || "No notes yet — add some via Edit."}
                </p>
              )}
              {tab === "care" && (
                <p className={cn("whitespace-pre-wrap text-sm", !item.care && "py-8 text-center text-muted-foreground")}>
                  {item.care || "No care instructions yet — add them via Edit (e.g. wash at 30°C)."}
                </p>
              )}
            </div>
          </Card>
        </>
      )}

      {user && item && (
        <ItemFormDialog open={editOpen} onOpenChange={setEditOpen} userId={user.uid} item={item} onSaved={() => load({ quiet: true })} />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this item?"
        description="This permanently deletes the item and its photos. Consider Retire instead — it keeps the history."
        onConfirm={async () => {
          if (item) {
            await deleteClothing(item.id);
            router.push("/wardrobe");
          }
        }}
      />
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-bold tabular-nums", highlight && "text-primary")}>{value}</p>
    </div>
  );
}
