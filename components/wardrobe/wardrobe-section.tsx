"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shirt, Plus, Pencil, Trash2 } from "lucide-react";
import { getClothing, deleteClothing, updateClothing } from "@/lib/firebase/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClothingFormDialog } from "@/components/wardrobe/clothing-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { ClothingItem } from "@/lib/types";

export function WardrobeSection({ userId }: { userId: string }) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; item: ClothingItem | null }>({
    open: false,
    item: null,
  });
  const [deleting, setDeleting] = useState<ClothingItem | null>(null);

  const load = useCallback(async () => {
    setItems(await getClothing(userId));
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const item of items) for (const t of item.tags) s.add(t);
    return Array.from(s).sort();
  }, [items]);

  const visible = activeTag
    ? items.filter((i) => i.tags.includes(activeTag))
    : items;

  async function wear(item: ClothingItem) {
    const next = item.timesWorn + 1;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, timesWorn: next } : i))
    );
    await updateClothing(item.id, { timesWorn: next });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Shirt className="h-4 w-4" /> Wardrobe
          {items.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {items.length}
            </span>
          )}
        </h2>
        {(items.length > 0 || !loaded) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setForm({ open: true, item: null })}
          >
            <Plus className="h-4 w-4" /> Add item
          </Button>
        )}
      </div>

      {/* Tag filter — active pills are filled, inactive are outline. */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag == null}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeTag == null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent"
            )}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              aria-pressed={activeTag === tag}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeTag === tag
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-accent"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loaded && items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Shirt className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">No clothing items yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Photograph your go-to pieces so picking an outfit takes seconds,
              not decisions.
            </p>
            <Button size="sm" onClick={() => setForm({ open: true, item: null })}>
              <Plus className="h-4 w-4" /> Add your first item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((item) => (
            <Card key={item.id} className="card-interactive animate-fade-slide-in overflow-hidden">
              <div className="aspect-square w-full bg-muted/40">
                {item.imageData ? (
                  // Inline data-URL thumbnails; lazy-loaded below the fold.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageData}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Shirt className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <CardContent className="space-y-1 p-2.5">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">
                    {item.tags.length > 0 ? item.tags.join(" · ") : "no tags"}
                  </span>
                  <span className="shrink-0">worn {item.timesWorn}×</span>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={() => wear(item)}
                  >
                    Wear today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Edit item"
                    onClick={() => setForm({ open: true, item })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label="Delete item"
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClothingFormDialog
        open={form.open}
        onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}
        userId={userId}
        item={form.item}
        onSaved={load}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this item?"
        description="Its photo can't be recovered — you'd need to re-upload it."
        onConfirm={async () => {
          if (deleting) {
            await deleteClothing(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </section>
  );
}
