"use client";

import Link from "next/link";
import { Heart, Pencil, Shirt, ExternalLink, Archive, ArchiveRestore } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusSelect } from "@/components/wardrobe/status-select";
import { costPerWear, relativeDay, colorSwatch, wearHealth } from "@/lib/wardrobe";
import { formatAmount, type Currency } from "@/lib/currency";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { ClothingItem, Outfit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ClothingItem | null;
  outfits: Outfit[];
  currency: Currency | null;
  onPatch: (item: ClothingItem, patch: Partial<ClothingItem>) => void;
  onEdit: (item: ClothingItem) => void;
}

/** Fast slide-over preview of a clothing item — no full-page navigation. */
export function ItemQuickView({ open, onOpenChange, item, outfits, currency, onPatch, onEdit }: Props) {
  const worn = item ? relativeDay(item.lastWorn, toDateKey(new Date())) : null;
  const cpw = item ? costPerWear(item) : null;
  const inOutfits = item ? outfits.filter((o) => o.itemIds.includes(item.id)) : [];
  const swatch = item ? colorSwatch(item.color) : null;
  const health = item ? wearHealth(item) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-0">
        {item && (
          <>
            <SheetHeader className="border-b px-5 py-4 pr-12">
              <SheetTitle className="truncate">{item.name}</SheetTitle>
              <SheetDescription>
                {[item.brand, item.category].filter(Boolean).join(" · ") || "Wardrobe item"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Photo */}
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-muted/40">
                {item.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageData} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Shirt className="h-12 w-12 text-muted-foreground/40" /></div>
                )}
                <button
                  type="button"
                  aria-label={item.favorite ? "Unfavorite" : "Favorite"}
                  onClick={() => onPatch(item, { favorite: !item.favorite })}
                  className={cn(
                    "absolute right-2 top-2 rounded-full bg-black/45 p-2 backdrop-blur transition",
                    item.favorite ? "text-rose-400" : "text-white/80 hover:text-white"
                  )}
                >
                  <Heart className={cn("h-4 w-4", item.favorite && "fill-current")} />
                </button>
                {item.extraImages.length > 0 && (
                  <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-gradient-to-t from-black/50 to-transparent p-2">
                    {item.extraImages.slice(0, 3).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className="h-9 w-9 rounded-md border border-white/30 object-cover" />
                    ))}
                  </div>
                )}
              </div>

              {/* Status control */}
              <StatusSelect
                status={item.status}
                needsIroning={item.needsIroning}
                onChange={(patch) => onPatch(item, patch)}
              />

              {health?.suggestWash && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                  <span>🧺 Worn {item.wearsSinceWash}× — time for a wash?</span>
                  <Button size="sm" variant="outline" onClick={() => onPatch(item, { status: "dirty" })}>Mark dirty</Button>
                </div>
              )}

              {/* Facts */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <Fact label="Times worn" value={item.timesWorn > 0 ? `${item.timesWorn}×` : "Never"} />
                <Fact label="Last worn" value={worn ?? "—"} />
                {health && <Fact label="Freshness" value={<span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: health.color }} />{health.label}</span>} />}
                {swatch || item.color ? (
                  <Fact
                    label="Colour"
                    value={
                      <span className="flex items-center gap-1.5">
                        {swatch && <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: swatch }} />}
                        {item.color}
                      </span>
                    }
                  />
                ) : null}
                {item.size && <Fact label="Size" value={item.size} />}
                {item.seasons.length > 0 && <Fact label="Season" value={item.seasons.join(", ")} />}
                {item.styles.length > 0 && <Fact label="Style" value={item.styles.join(", ")} />}
                {item.cost != null && currency && <Fact label="Price" value={formatAmount(item.cost, currency)} />}
                {cpw != null && currency && <Fact label="Cost / wear" value={`${formatAmount(cpw, currency)}`} />}
                {item.purchaseDate && <Fact label="Bought" value={item.purchaseDate} />}
              </div>

              {/* Outfits */}
              {inOutfits.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In outfits</p>
                  <div className="flex flex-wrap gap-1.5">
                    {inOutfits.map((o) => (
                      <span key={o.id} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{o.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {(item.notes || item.care) && (
                <div className="space-y-2">
                  {item.notes && <p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm">{item.notes}</p>}
                  {item.care && <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">🧺 {item.care}</p>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 border-t p-4">
              <Button className="flex-1" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" /> Edit</Button>
              <Button variant="outline" asChild>
                <Link href={`/wardrobe/item/${item.id}`}><ExternalLink className="h-4 w-4" /> Full details</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={item.retired ? "Unretire" : "Retire"}
                title={item.retired ? "Unretire" : "Retire"}
                onClick={() => onPatch(item, { retired: !item.retired })}
              >
                {item.retired ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}
