"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Shirt } from "lucide-react";
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
import { NumberField } from "@/components/ui/number-field";
import {
  createClothing,
  updateClothing,
  type ClothingInput,
} from "@/lib/firebase/db";
import { compressImageToThumbnail } from "@/lib/images";
import type { ClothingItem } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  item?: ClothingItem | null;
  onSaved: () => void;
}

export function ClothingFormDialog({
  open,
  onOpenChange,
  userId,
  item,
  onSaved,
}: Props) {
  const isEdit = Boolean(item);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [timesWorn, setTimesWorn] = useState<number>(0);
  const [imageData, setImageData] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setTags(item?.tags?.join(", ") ?? "");
    setCost(item?.cost ?? null);
    setTimesWorn(item?.timesWorn ?? 0);
    setImageData(item?.imageData ?? null);
    setError(null);
  }, [open, item]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      // Square center-crop + downscale + compress happens client-side, so
      // thumbnails stay consistent and Firestore docs stay small.
      setImageData(await compressImageToThumbnail(file));
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
    const payload: ClothingInput = {
      name: name.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      imageData,
      cost,
      timesWorn: Math.max(0, Math.round(timesWorn)),
    };
    try {
      if (isEdit && item) {
        await updateClothing(item.id, payload);
      } else {
        await createClothing(userId, payload);
      }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "Add clothing item"}</DialogTitle>
          <DialogDescription>
            A photo makes picking outfits much faster.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40 transition-colors hover:border-primary/50"
              aria-label={imageData ? "Replace image" : "Add image"}
            >
              {imageData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageData}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Shirt className="h-8 w-8 text-muted-foreground" />
              )}
            </button>
            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={processing}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {processing
                  ? "Processing…"
                  : imageData
                    ? "Replace photo"
                    : "Upload photo"}
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG/PNG/WEBP — auto-cropped square &amp; compressed.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blue Oxford shirt"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-tags">Tags</Label>
            <Input
              id="c-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. work, casual"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated — used to filter (gym, work, casual…).
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-1">
              <Label className="text-xs">Cost (optional)</Label>
              <NumberField
                value={cost}
                onCommit={setCost}
                min={0}
                placeholder="—"
                aria-label="Cost"
                inputClassName="w-20"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Times worn</Label>
              <NumberField
                value={timesWorn}
                onCommit={setTimesWorn}
                min={0}
                decimals={false}
                aria-label="Times worn"
                inputClassName="w-16"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || processing}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
