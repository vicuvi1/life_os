"use client";

import Link from "next/link";
import { Heart, Shirt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusSelect } from "@/components/wardrobe/status-select";
import { relativeDay } from "@/lib/wardrobe";
import { toDateKey } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { ClothingItem, WardrobeStatus } from "@/lib/types";

interface Props {
  item: ClothingItem;
  onStatusChange: (item: ClothingItem, patch: { status?: WardrobeStatus; needsIroning?: boolean }) => void;
  onToggleFavorite: (item: ClothingItem) => void;
  /** Selection mode (laundry bulk actions / outfit picking). */
  selected?: boolean;
  onSelect?: (item: ClothingItem) => void;
}

export function ItemCard({ item, onStatusChange, onToggleFavorite, selected, onSelect }: Props) {
  const worn = relativeDay(item.lastWorn, toDateKey(new Date()));
  const meta = [item.brand, item.category].filter(Boolean).join(" · ");
  const tagline = [item.seasons[0], item.styles[0]].filter(Boolean).join(" • ");

  const inner = (
    <Card
      className={cn(
        "card-interactive group h-full overflow-hidden",
        selected && "ring-2 ring-primary",
        item.retired && "opacity-50"
      )}
    >
      <div className="relative aspect-square w-full bg-muted/40">
        {item.imageData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageData} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Shirt className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <button
          type="button"
          aria-label={item.favorite ? "Unfavorite" : "Favorite"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(item);
          }}
          className={cn(
            "absolute right-1.5 top-1.5 rounded-full bg-black/45 p-1.5 backdrop-blur transition",
            item.favorite ? "text-rose-400" : "text-white/70 opacity-0 group-hover:opacity-100"
          )}
        >
          <Heart className={cn("h-3.5 w-3.5", item.favorite && "fill-current")} />
        </button>
        {item.needsIroning && !item.retired && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white" title="Needs ironing">👔</span>
        )}
        {item.retired && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">Retired</span>
        )}
        {/* Usage counter + last-worn, Apple-Photos style overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-5 text-[10px] font-medium text-white">
          <span className="tabular-nums">{item.timesWorn > 0 ? `${item.timesWorn}× worn` : "never worn"}</span>
          {worn && <span className="opacity-80">{worn}</span>}
        </div>
      </div>
      <div className="space-y-1 p-2.5">
        <p className="truncate text-sm font-medium">{item.name}</p>
        {(meta || tagline) && (
          <p className="truncate text-[11px] text-muted-foreground">
            {meta}
            {meta && tagline ? " · " : ""}
            {tagline}
          </p>
        )}
        <StatusSelect
          compact
          status={item.status}
          needsIroning={item.needsIroning}
          onChange={(patch) => onStatusChange(item, patch)}
        />
      </div>
    </Card>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(item)} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return (
    <Link href={`/wardrobe/item/${item.id}`} className="block">
      {inner}
    </Link>
  );
}
