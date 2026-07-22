"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCENTS, setStoredAccent, storedAccent } from "@/lib/accent";
import { cn } from "@/lib/utils";

export function AccentCard() {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(storedAccent() ?? ACCENTS[0].hsl);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Accent colour</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Make it yours — your colour flows through buttons, links, and highlights across the app.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => {
            const active = selected === a.hsl;
            return (
              <button
                key={a.hsl}
                type="button"
                onClick={() => {
                  setStoredAccent(a.hsl);
                  setSelected(a.hsl);
                }}
                aria-label={a.name}
                aria-pressed={active}
                title={a.name}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                  active && "ring-2 ring-foreground"
                )}
                style={{ backgroundColor: `hsl(${a.hsl})` }}
              >
                {active && <Check className="h-4 w-4 text-white" />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
