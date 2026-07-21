"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
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
import { createClothing, updateClothing, type ClothingInput } from "@/lib/firebase/db";
import { compressImageToThumbnail } from "@/lib/images";
import { DEFAULT_CATEGORIES, DEFAULT_SEASONS, DEFAULT_STYLES } from "@/lib/wardrobe";
import { cn } from "@/lib/utils";
import type { ClothingItem } from "@/lib/types";

const MAX_PHOTOS = 4; // primary + 3 extra, all inline in one Firestore doc

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  item?: ClothingItem | null;
  onSaved: () => void;
}

/** Toggleable chip list with a free-text "add your own" input. */
function TagChips({ value, onChange, suggestions, addLabel }: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  addLabel: string;
}) {
  const [custom, setCustom] = useState("");
  const all = [...suggestions, ...value.filter((v) => !suggestions.includes(v))];
  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }
  function addCustom() {
    const t = custom.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setCustom("");
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {all.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
              value.includes(tag)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder={addLabel}
          className="h-7 flex-1 text-xs"
        />
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addCustom} disabled={!custom.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function ItemFormDialog({ open, onOpenChange, userId, item, onSaved }: Props) {
  const isEdit = Boolean(item);
  const fileRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [cost, setCost] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [notes, setNotes] = useState("");
  const [care, setCare] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setImages(item ? [item.imageData, ...item.extraImages].filter((s): s is string => Boolean(s)) : []);
    setName(item?.name ?? "");
    setCategory(item?.category ?? "");
    setBrand(item?.brand ?? "");
    setColor(item?.color ?? "");
    setSize(item?.size ?? "");
    setSeasons(item?.seasons ?? []);
    setStyles(item?.styles ?? []);
    setPurchaseDate(item?.purchaseDate ?? "");
    setCost(item?.cost != null ? String(item.cost) : "");
    setFavorite(item?.favorite ?? false);
    setNotes(item?.notes ?? "");
    setCare(item?.care ?? "");
    setError(null);
  }, [open, item]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const room = MAX_PHOTOS - images.length;
      const picked = Array.from(files).slice(0, room);
      const compressed: string[] = [];
      for (const f of picked) compressed.push(await compressImageToThumbnail(f));
      setImages((prev) => [...prev, ...compressed].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't process the image.");
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the item a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const costNum = cost.trim() === "" ? null : Math.max(0, Math.round(Number(cost) * 100) / 100);
    const payload: ClothingInput = {
      name: name.trim(),
      tags: item?.tags ?? [],
      imageData: images[0] ?? null,
      extraImages: images.slice(1),
      category: category.trim() || null,
      brand: brand.trim() || null,
      color: color.trim() || null,
      size: size.trim() || null,
      seasons,
      styles,
      purchaseDate: purchaseDate || null,
      cost: Number.isNaN(costNum) ? null : costNum,
      favorite,
      notes: notes.trim() || null,
      care: care.trim() || null,
      timesWorn: item?.timesWorn ?? 0,
    };
    try {
      if (isEdit && item) await updateClothing(item.id, payload);
      else await createClothing(userId, payload);
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
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "Add clothing item"}</DialogTitle>
          <DialogDescription>Photos make picking outfits effortless — first photo is the thumbnail.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photos */}
          <div className="space-y-2">
            <Label>Photos ({images.length}/{MAX_PHOTOS})</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/55 py-0.5 text-center text-[9px] font-medium text-white">primary</span>
                  )}
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => setImages([images[i], ...images.filter((_, j) => j !== i)])}
                      className="absolute left-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      title="Make primary"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {images.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={processing}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition hover:bg-accent"
                >
                  {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span className="text-[10px]">Add</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="w-name">Name</Label>
              <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. White Nike T-Shirt" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-category">Category</Label>
              <Input id="w-category" list="wardrobe-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Tops, Footwear…" />
              <datalist id="wardrobe-categories">
                {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-brand">Brand</Label>
              <Input id="w-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Nike" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-color">Color</Label>
              <Input id="w-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="White" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-size">Size</Label>
              <Input id="w-size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="M / 42 / …" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-date">Purchase date</Label>
              <Input id="w-date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-price">Price</Label>
              <Input id="w-price" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Seasons</Label>
            <TagChips value={seasons} onChange={setSeasons} suggestions={DEFAULT_SEASONS} addLabel="Add a season…" />
          </div>
          <div className="space-y-1.5">
            <Label>Styles</Label>
            <TagChips value={styles} onChange={setStyles} suggestions={DEFAULT_STYLES} addLabel="Add a style…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="w-notes">Notes</Label>
            <Textarea id="w-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-care">Care instructions</Label>
            <Textarea id="w-care" value={care} onChange={(e) => setCare(e.target.value)} placeholder="e.g. wash at 30°C, no dryer" rows={2} />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Mark as favorite ❤️
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || processing}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
