"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Shirt, X, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createOutfit, updateOutfit, type OutfitInput } from "@/lib/firebase/db";
import { DEFAULT_OCCASIONS, DEFAULT_SEASONS, categoriesInUse, filterItems } from "@/lib/wardrobe";
import { TagChips } from "@/components/wardrobe/tag-chips";
import { cn } from "@/lib/utils";
import type { ClothingItem, Outfit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  items: ClothingItem[];
  outfit?: Outfit | null; // edit when set
  onSaved: () => void;
}

export function OutfitBuilderDialog({ open, onOpenChange, userId, items, outfit, onSaved }: Props) {
  const isEdit = Boolean(outfit);
  const [name, setName] = useState("");
  const [type, setType] = useState<"template" | "custom">("custom");
  const [selected, setSelected] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [weatherFit, setWeatherFit] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(outfit?.name ?? "");
    setType(outfit?.type ?? "custom");
    setSelected(outfit?.itemIds ?? []);
    setOccasions(outfit?.occasions ?? []);
    setSeasons(outfit?.seasons ?? []);
    setWeatherFit(outfit?.weatherFit ?? "");
    setNotes(outfit?.notes ?? "");
    setQuery("");
    setCategory(null);
    setError(null);
  }, [open, outfit]);

  const categories = useMemo(() => categoriesInUse(items.filter((i) => !i.retired)), [items]);
  const pickable = useMemo(
    () => filterItems(items, { query, category, includeRetired: false }),
    [items, query, category]
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** Insert (or move) an item to a position — powers add-by-drag and reorder. */
  function insertAt(id: string, index: number) {
    setSelected((prev) => {
      const without = prev.filter((x) => x !== id);
      const clamped = Math.max(0, Math.min(index, without.length));
      return [...without.slice(0, clamped), id, ...without.slice(clamped)];
    });
  }
  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  async function save() {
    if (!name.trim()) {
      setError("Give the outfit a name.");
      return;
    }
    if (selected.length === 0) {
      setError("Pick at least one item.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload: OutfitInput = {
      name: name.trim(),
      type,
      itemIds: selected,
      occasions,
      seasons,
      rating: outfit?.rating ?? null,
      weatherFit: weatherFit.trim() || null,
      notes: notes.trim() || null,
      favorite: outfit?.favorite ?? false,
    };
    try {
      if (isEdit && outfit) await updateOutfit(outfit.id, payload);
      else await createOutfit(userId, payload);
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit outfit" : "New outfit"}</DialogTitle>
          <DialogDescription>Combine items into a reusable look — templates show up as shortcuts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="o-name">Name</Label>
              <Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. University" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(["custom", "template"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition",
                      type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Your outfit — drop zone (drag items in, reorder, ×-to-remove) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <GripVertical className="h-3.5 w-3.5" /> Your outfit ({selected.length})
            </Label>
            <div
              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (dragId) { insertAt(dragId, selected.length); setDragId(null); } }}
              className={cn(
                "flex min-h-[84px] flex-wrap items-center gap-2 rounded-xl border-2 border-dashed p-2 transition",
                dragId ? "border-primary bg-primary/5" : "border-muted-foreground/20 bg-muted/20"
              )}
            >
              {selected.length === 0 ? (
                <span className="mx-auto text-xs text-muted-foreground">Drag clothes here, or tap them below.</span>
              ) : (
                selected.map((id, index) => {
                  const it = byId.get(id);
                  if (!it) return null;
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => setDragId(id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragId) { insertAt(dragId, index); setDragId(null); } }}
                      title={it.name}
                      className={cn("group relative h-14 w-14 shrink-0 cursor-grab overflow-hidden rounded-lg border active:cursor-grabbing", dragId === id && "opacity-40")}
                    >
                      {it.imageData ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.imageData} alt={it.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-muted/40"><Shirt className="h-5 w-5 text-muted-foreground/50" /></span>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${it.name}`}
                        onClick={() => remove(id)}
                        className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Item picker */}
          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pick items ({selected.length})</Label>
              <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="ml-auto h-8 w-[160px]" />
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setCategory(null)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category == null ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>All</button>
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(category === c ? null : c)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", category === c ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-accent")}>{c}</button>
                ))}
              </div>
            )}
            {pickable.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No matching items.</p>
            ) : (
              <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5 md:grid-cols-6">
                {pickable.map((item) => {
                  const on = selected.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => toggle(item.id)}
                      className={cn("relative cursor-grab overflow-hidden rounded-lg border text-left transition active:cursor-grabbing", on ? "ring-2 ring-primary" : "hover:border-primary/40")}
                    >
                      <div className="aspect-square w-full bg-muted/40">
                        {item.imageData ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageData} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Shirt className="h-6 w-6 text-muted-foreground/40" /></div>
                        )}
                      </div>
                      {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-2.5 w-2.5" /></span>}
                      <p className="truncate px-1 py-0.5 text-[10px] font-medium">{item.name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Occasions</Label>
            <TagChips value={occasions} onChange={setOccasions} suggestions={DEFAULT_OCCASIONS} addLabel="Add an occasion…" />
          </div>

          <div className="space-y-1.5">
            <Label>Seasons</Label>
            <TagChips value={seasons} onChange={setSeasons} suggestions={DEFAULT_SEASONS} addLabel="Add a season…" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="o-weather">Weather fit (optional)</Label>
              <Input id="o-weather" value={weatherFit} onChange={(e) => setWeatherFit(e.target.value)} placeholder="e.g. 18-28°C, sunny" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-notes">About this outfit</Label>
              <Textarea id="o-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" rows={1} />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : `Create ${type === "template" ? "template" : "outfit"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
