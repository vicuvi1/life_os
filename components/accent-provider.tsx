"use client";

import { useEffect } from "react";
import { applyAccent, storedAccent } from "@/lib/accent";

/** Applies the user's saved accent colour on load. Renders nothing. */
export function AccentProvider() {
  useEffect(() => {
    const a = storedAccent();
    if (a) applyAccent(a);
  }, []);
  return null;
}
