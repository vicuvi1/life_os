"use client";

import { useEffect, useState } from "react";
import { Utensils } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FoodPicker } from "@/components/nutrition/food-picker";
import { createPantryItem, updatePantryItem, deletePantryItem, type PantryInput } from "@/lib/firebase/db";
import { toDateKey } from "@/lib/greeting";
import type { FoodItem, FoodUnit, PantryItem } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  item?: PantryItem | null;
  foods: FoodItem[];
  onSaved: () => void;
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Math.max(0, Number(s)) || (Number(s) === 0 ? 0 : null));

export function PantryDialog({ open, onOpenChange, userId, item, foods, onSaved }: Props) {
  const [foodId, setFoodId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<FoodUnit>("g");
  const [quantity, setQuantity] = useState("");
  const [remaining, setRemaining] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [expiration, setExpiration] = useState("");
  const [price, setPrice] = useState("");
  const [low, setLow] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFoodId(item?.foodId ?? null);
    setName(item?.name ?? "");
    setUnit(item?.unit ?? "g");
    setQuantity(item?.quantity != null ? String(item.quantity) : "");
    setRemaining(item?.quantityRemaining != null ? String(item.quantityRemaining) : "");
    setPurchaseDate(item?.purchaseDate ?? (item ? "" : toDateKey(new Date())));
    setExpiration(item?.expirationDate ?? "");
    setPrice(item?.purchasePrice != null ? String(item.purchasePrice) : "");
    setLow(item?.lowThreshold != null ? String(item.lowThreshold) : "");
    setPicking(false);
  }, [open, item]);

  function pickFood(f: FoodItem) {
    setFoodId(f.id);
    setName(f.name);
    setUnit(f.unit);
    if (!quantity && f.quantityPurchased != null) setQuantity(String(f.quantityPurchased));
    if (!remaining && f.quantityPurchased != null) setRemaining(String(f.quantityPurchased));
    if (!price && f.purchasePrice != null) setPrice(String(f.purchasePrice));
    setPicking(false);
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const q = numOrNull(quantity);
    const input: PantryInput = {
      foodId,
      name: name.trim(),
      unit,
      quantity: q,
      quantityRemaining: numOrNull(remaining) ?? q ?? 0,
      purchaseDate: purchaseDate || null,
      expirationDate: expiration || null,
      purchasePrice: numOrNull(price),
      lowThreshold: numOrNull(low),
    };
    try {
      if (item) await updatePantryItem(item.id, input);
      else await createPantryItem(userId, input);
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item) return;
    setBusy(true);
    try {
      await deletePantryItem(item.id);
      onOpenChange(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit pantry item" : "Add to pantry"}</DialogTitle>
          <DialogDescription>Track what you have on hand. Meals draw it down automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Food</Label>
            {picking ? (
              <FoodPicker foods={foods} onPick={pickFood} />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2">
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                  <Input value={name} onChange={(e) => { setName(e.target.value); setFoodId(null); }} placeholder="Item name" className="h-auto border-0 p-0 shadow-none focus-visible:ring-0" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>{foodId ? "Change" : "From library"}</Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label className="text-xs">Remaining</Label><Input type="number" min={0} value={remaining} onChange={(e) => setRemaining(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1"><Label className="text-xs">Purchased</Label><Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as FoodUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="g">g</SelectItem><SelectItem value="ml">ml</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Purchase date</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Expiration date</Label><Input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Purchase price</Label><Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="—" /></div>
            <div className="space-y-1"><Label className="text-xs">Low-stock alert at ({unit})</Label><Input type="number" min={0} value={low} onChange={(e) => setLow(e.target.value)} placeholder="—" /></div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {item ? (
            <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-600 dark:text-rose-400" onClick={remove} disabled={busy}>Delete</Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={busy || !name.trim()}>{busy ? "Saving…" : item ? "Save" : "Add"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
