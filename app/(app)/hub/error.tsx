"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HubError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Agent Hub error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16">
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="font-medium">The Agent Hub hit a snag</p>
        <p className="text-sm text-muted-foreground">{error.message || "Something went wrong loading the hub."}</p>
        <Button onClick={reset}><RotateCcw className="h-4 w-4" /> Try again</Button>
      </Card>
    </div>
  );
}
