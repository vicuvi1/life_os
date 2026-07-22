"use client";

// Apple-Watch-style concentric progress rings for the day's macros.

interface RingSpec {
  label: string;
  pct: number; // 0..100+
  color: string; // hex
}

function Arc({ r, pct, color }: { r: number; pct: number; color: string }) {
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct / 100));
  return (
    <>
      <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={9} />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}
      />
    </>
  );
}

export function NutritionRings({
  rings,
  center,
}: {
  rings: RingSpec[]; // outer → inner
  center?: { value: string; label: string };
}) {
  const radii = [55, 42, 29];
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 140 140" className="h-36 w-36">
        {rings.slice(0, 3).map((rg, i) => (
          <Arc key={rg.label} r={radii[i]} pct={rg.pct} color={rg.color} />
        ))}
        {center && (
          <>
            <text x="70" y="66" textAnchor="middle" className="fill-foreground text-[22px] font-bold">
              {center.value}
            </text>
            <text x="70" y="84" textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase tracking-wider">
              {center.label}
            </text>
          </>
        )}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
        {rings.map((rg) => (
          <span key={rg.label} className="flex items-center gap-1 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rg.color }} />
            {rg.label} {Math.round(rg.pct)}%
          </span>
        ))}
      </div>
    </div>
  );
}
