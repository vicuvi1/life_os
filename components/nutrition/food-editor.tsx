"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compressImageToThumbnail } from "@/lib/images";
import { createFood, updateFood, deleteFood, type FoodInput } from "@/lib/firebase/db";
import { FOOD_CATEGORIES, FOOD_UNITS, defaultServings, costPerBase, costPerServing, genId } from "@/lib/food";
import { CURRENCIES, formatAmount, type Currency } from "@/lib/currency";
import type { FoodItem, FoodServing, FoodUnit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  food?: FoodItem | null;
  defaultCurrency: string; // currency code
  onSaved: () => void;
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s)) || (Number(s) === 0 ? 0 : null));

export function FoodEditor({ open, onOpenChange, userId, food, defaultCurrency, onSaved }: Props) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [unit, setUnit] = useState<FoodUnit>("g");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [servings, setServings] = useState<FoodServing[]>(defaultServings("g"));
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(food?.name ?? "");
    setBrand(food?.brand ?? "");
    setCategory(food?.category ?? "");
    setNotes(food?.notes ?? "");
    setImageData(food?.imageData ?? null);
    setUnit(food?.unit ?? "g");
    setCalories(food?.calories != null ? String(food.calories) : "");
    setProtein(food?.protein != null ? String(food.protein) : "");
    setCarbs(food?.carbs != null ? String(food.carbs) : "");
    setFat(food?.fat != null ? String(food.fat) : "");
    setPrice(food?.purchasePrice != null ? String(food.purchasePrice) : "");
    setQty(food?.quantityPurchased != null ? String(food.quantityPurchased) : "");
    setCurrency(food?.currency ?? defaultCurrency);
    setServings(food?.servings?.length ? food.servings : defaultServings(food?.unit ?? "g"));
    setTags(food?.tags?.length ? food.tags.join(", ") : "");
    setImgError(null);
  }, [open, food, defaultCurrency]);

  const cur: Currency = CURRENCIES.find((c) => c.code === currency) ?? { code: currency, label: currency, symbol: currency, suffix: false };
  const pricing = { purchasePrice: numOrNull(price), quantityPurchased: numOrNull(qty) };
  const cpb = costPerBase(pricing);
  const firstServing = servings[0];

  async function handleFile(file?: File) {
    if (!file) return;
    setImgError(null);
    try {
      setImageData(await compressImageToThumbnail(file));
    } catch (e) {
      setImgError(e instanceof Error ? e.message : "Couldn't add image.");
    }
  }

  function setServing(id: string, patch: Partial<FoodServing>) {
    setServings((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addServing() {
    setServings((prev) => [...prev, { id: genId(), label: "", grams: 0 }]);
  }
  function removeServing(id: string) {
    setServings((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const cleanServings = servings
      .map((s) => ({ id: s.id, label: s.label.trim() || `${s.grams} ${unit}`, grams: Math.max(0, s.grams) }))
      .filter((s) => s.grams > 0);
    const input: FoodInput = {
      name: name.trim(),
      brand: brand.trim() || null,
      category: category || null,
      notes: notes.trim() || null,
      imageData,
      unit,
      calories: numOrNull(calories),
      protein: numOrNull(protein),
      carbs: numOrNull(carbs),
      fat: numOrNull(fat),
      purchasePrice: numOrNull(price),
      quantityPurchased: numOrNull(qty),
      currency,
      servings: cleanServings.length ? cleanServings : defaultServings(unit),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (food) await updateFood(food.id, input);
      else await createFood(userId, input);
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!food) return;
    setBusy(true);
    try {
      await deleteFood(food.id);
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>{food ? "Edit food" : "New food"}</SheetTitle>
          <SheetDescription>Reusable across all your meals. Cost is auto-calculated.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-5 py-5">
          {/* Basic */}
          <section className="space-y-3">
            <SectionLabel>Basic</SectionLabel>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground transition hover:bg-accent"
                aria-label={imageData ? "Replace image" : "Add image"}
              >
                {imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageData} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6" />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <div className="flex-1 space-y-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Food name (e.g. Chicken breast)" autoFocus />
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" />
              </div>
            </div>
            {imageData && (
              <button type="button" onClick={() => setImageData(null)} className="text-xs text-muted-foreground underline">Remove image</button>
            )}
            {imgError && <p className="text-xs text-rose-500">{imgError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {FOOD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Measured in</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as FoodUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FOOD_UNITS.map((u) => <SelectItem key={u} value={u}>{u === "g" ? "Grams (g)" : "Millilitres (ml)"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="high-protein, cheap, staple (comma-separated)" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Where you buy it, prep tips…" />
            </div>
          </section>

          {/* Nutrition */}
          <section className="space-y-3">
            <SectionLabel>Nutrition <span className="font-normal normal-case text-muted-foreground">· per 100 {unit}</span></SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              <Field label="Calories" value={calories} onChange={setCalories} />
              <Field label="Protein" value={protein} onChange={setProtein} suffix="g" />
              <Field label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
              <Field label="Fat" value={fat} onChange={setFat} suffix="g" />
            </div>
          </section>

          {/* Pricing */}
          <section className="space-y-3">
            <SectionLabel>Pricing</SectionLabel>
            <div className="grid grid-cols-[1fr_1fr_100px] gap-2">
              <Field label="Purchase price" value={price} onChange={setPrice} step="0.01" />
              <Field label={`Quantity (${unit})`} value={qty} onChange={setQty} />
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Calc label={`Cost / ${unit}`} value={cpb != null ? formatAmount(cpb, cur) : "—"} />
              <Calc label={`Cost / serving${firstServing ? ` (${firstServing.label})` : ""}`} value={cpb != null && firstServing ? formatAmount(costPerServing(pricing, firstServing) ?? 0, cur) : "—"} />
            </div>
          </section>

          {/* Servings */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Serving sizes</SectionLabel>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={addServing}><Plus className="h-3.5 w-3.5" /> Add</Button>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">Define portions like &quot;1 Egg&quot;, &quot;1 Slice&quot;, &quot;1 Cup&quot; — enter how many {unit} each equals.</p>
            <div className="space-y-2">
              {servings.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Input value={s.label} onChange={(e) => setServing(s.id, { label: e.target.value })} placeholder="Label (e.g. 1 Egg)" className="flex-1" />
                  <div className="relative w-28">
                    <Input type="number" min={0} value={s.grams || ""} onChange={(e) => setServing(s.id, { grams: Number(e.target.value) || 0 })} placeholder="0" className="pr-8" />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={() => removeServing(s.id)} disabled={servings.length <= 1} aria-label="Remove serving"><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-card px-5 py-3">
          {food ? (
            <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-600 dark:text-rose-400" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" /> Delete</Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={busy || !name.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{food ? "Save" : "Add food"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

function Field({ label, value, onChange, suffix, step }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; step?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input type="number" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" className={suffix ? "pr-7" : ""} />
        {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function Calc({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
