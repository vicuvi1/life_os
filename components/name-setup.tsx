"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

/** One-time prompt to capture a first name so greetings feel personal. */
export function NameSetup() {
  const { updateName } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateName(name.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="p-5">
        <p className="font-medium">👋 What should we call you?</p>
        <p className="mb-3 text-sm text-muted-foreground">
          We&apos;ll use your first name in greetings instead of your email.
        </p>
        <form onSubmit={save} className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Victor"
            autoFocus
            maxLength={40}
          />
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
