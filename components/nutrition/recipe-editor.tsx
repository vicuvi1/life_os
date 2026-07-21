"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FoodEntryBuilder } from "@/components/nutrition/food-entry-builder";
import { compressImageToThumbnail } from "@/lib/images";
import { createRecipe, updateRecipe, deleteRecipe, type RecipeInput } from "@/lib/firebase/db";
import { type Currency } from "@/lib/currency";
import type { Recipe, RecipeKind, MealFoodEntry, FoodItem } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  recipe?: Recipe | null;
  defaultKind?: RecipeKind;
  collections: string[];
  foods: FoodItem[];
  currency: Currency;
  onSaved: () => void;
  onManageFoods?: () => void;
}

export function RecipeEditor({ open, onOpenChange, userId, recipe, defaultKind = "recipe", collections, foods, currency, onSaved, onManageFoods }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RecipeKind>(defaultKind);
  const [imageData, setImageData] = useState<string | null>(null);
  const [collection, setCollection] = useState("");
  const [tags, setTags] = useState("");
  const [prep, setPrep] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<MealFoodEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(recipe?.name ?? "");
    setKind(recipe?.kind ?? defaultKind);
    setImageData(recipe?.imageData ?? null);
    setCollection(recipe?.collection ?? "");
    setTags(recipe?.tags?.length ? recipe.tags.join(", ") : "");
    setPrep(recipe?.prepMinutes != null ? String(recipe.prepMinutes) : "");
    setNotes(recipe?.notes ?? "");
    setItems(recipe?.items ? recipe.items.map((e) => ({ ...e })) : []);
    setImgError(null);
  }, [open, recipe, defaultKind]);

  async function handleFile(file?: File) {
    if (!file) return;
    setImgError(null);
    try { setImageData(await compressImageToThumbnail(file)); }
    catch (e) { setImgError(e instanceof Error ? e.message : "Couldn't add image."); }
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const input: RecipeInput = {
      kind, name: name.trim(), imageData, notes: notes.trim() || null,
      prepMinutes: prep.trim() === "" ? null : Math.max(0, Math.round(Number(prep))) || (Number(prep) === 0 ? 0 : null),
      items: items.map((e, idx) => ({ ...e, sortOrder: idx })),
      collection: collection.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (recipe) await updateRecipe(recipe.id, input);
      else await createRecipe(userId, input);
      onOpenChange(false);
      onSaved();
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!recipe) return;
    setBusy(true);
    try { await deleteRecipe(recipe.id); onOpenChange(false); onSaved(); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>{recipe ? "Edit" : "New"} {kind === "template" ? "template" : "recipe"}</SheetTitle>
          <SheetDescription>A named set of foods. Macros and cost are calculated from the library.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 py-5">
          <div className="flex gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground transition hover:bg-accent" aria-label={imageData ? "Replace image" : "Add image"}>
              {imageData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageData} alt="" className="h-full w-full object-cover" />
              ) : <ImagePlus className="h-5 w-5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <div className="flex-1 space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "template" ? "Template name (e.g. Protein Lunch)" : "Recipe name (e.g. Chicken Rice Bowl)"} autoFocus />
              <Select value={kind} onValueChange={(v) => setKind(v as RecipeKind)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recipe">Recipe (a dish)</SelectItem>
                  <SelectItem value="template">Template (quick-log meal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {imageData && <button type="button" onClick={() => setImageData(null)} className="text-xs text-muted-foreground underline">Remove image</button>}
          {imgError && <p className="text-xs text-rose-500">{imgError}</p>}

          <div className="grid grid-cols-[1fr_1fr_110px] gap-3">
            <div className="space-y-1.5">
              <Label>Collection</Label>
              <Input value={collection} onChange={(e) => setCollection(e.target.value)} placeholder="e.g. Cheap dinners" list="recipe-collections" />
              <datalist id="recipe-collections">{collections.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="high-protein" />
            </div>
            <div className="space-y-1.5">
              <Label>Prep (min)</Label>
              <Input type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="—" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Foods</Label>
            <FoodEntryBuilder items={items} onChange={setItems} foods={foods} currency={currency} onManageFoods={onManageFoods} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Method, tips…" />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-card px-5 py-3">
          {recipe ? (
            <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-600 dark:text-rose-400" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" /> Delete</Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={busy || !name.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{recipe ? "Save" : "Create"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
