import { cn } from "@/lib/utils";

/** Pulsing placeholder block shown while data loads (no blank flashes). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-muted/70", className)}
      aria-hidden
    />
  );
}

/** A card-shaped skeleton with a few content lines. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)} aria-hidden>
      <Skeleton className="mb-3 h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("mb-2 h-3", i % 2 ? "w-2/3" : "w-5/6")} />
      ))}
    </div>
  );
}
