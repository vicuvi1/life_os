"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { resolveFirstName } from "@/lib/greeting";

export function ProfileNameField() {
  const { user, displayName, updateName } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await updateName(value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Name</p>
          <p className="text-sm text-muted-foreground">
            {displayName || resolveFirstName(null, user?.email)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setValue(displayName ?? "");
            setEditing(true);
          }}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Your name"
        maxLength={40}
        autoFocus
      />
      <Button onClick={save} disabled={saving || !value.trim()}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}
