"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  addLabel: string;
}

/** Toggleable chip list with a free-text "add your own" input — never a locked enum. */
export function TagChips({ value, onChange, suggestions, addLabel }: Props) {
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
