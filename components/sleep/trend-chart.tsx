"use client";

interface Series {
  label: string;
  color: string;
  /** One value per category; null = gap (not logged). */
  points: (number | null)[];
}

interface Props {
  categories: string[];
  series: Series[];
  /** Optional dashed reference line (e.g. sleep goal). */
  goal?: number | null;
  goalLabel?: string;
  /** Format a y value for point labels / axis (default: raw). */
  format?: (n: number) => string;
  /** Fix the y-range; otherwise derived from data. */
  min?: number;
  max?: number;
  /** Show the numeric value above each point of the first series. */
  showValues?: boolean;
  /** Shade a y-range behind the chart (e.g. the ideal bedtime window). */
  band?: { from: number; to: number; color?: string } | null;
  /** Emphasise specific points of the first series (best/worst night). */
  markers?: { index: number; kind: "best" | "worst" }[];
}

const W = 340;
const H = 150;
const PAD_X = 14;
const PAD_TOP = 22;
const PAD_BOTTOM = 22;

/** Small responsive multi-line chart (SVG). Handles gaps and an optional goal line. */
export function TrendChart({ categories, series, goal, goalLabel, format, min, max, showValues, band, markers }: Props) {
  const all = series.flatMap((s) => s.points).filter((n): n is number => n != null);
  if (goal != null) all.push(goal);
  if (band) { all.push(band.from, band.to); }
  const lo = min != null ? min : all.length ? Math.min(...all) : 0;
  const hi = max != null ? max : all.length ? Math.max(...all) : 1;
  const range = hi - lo || 1;
  const n = categories.length;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => (n <= 1 ? W / 2 : PAD_X + (i * innerW) / (n - 1));
  const y = (v: number) => PAD_TOP + innerH - ((v - lo) / range) * innerH;
  const fmt = format ?? ((v: number) => String(Math.round(v * 10) / 10));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none">
        {band && (
          <rect
            x={PAD_X}
            y={Math.min(y(band.from), y(band.to))}
            width={W - PAD_X * 2}
            height={Math.abs(y(band.from) - y(band.to)) || 1}
            fill={band.color ?? "#a78bfa"}
            opacity={0.12}
          />
        )}
        {goal != null && (
          <>
            <line x1={PAD_X} x2={W - PAD_X} y1={y(goal)} y2={y(goal)} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground/40" />
            <text x={W - PAD_X} y={y(goal) - 4} textAnchor="end" className="fill-muted-foreground text-[9px]">{goalLabel ?? fmt(goal)}</text>
          </>
        )}
        {series.map((s) => {
          const pts = s.points.map((p, i) => (p == null ? null : { x: x(i), y: y(p) }));
          // Draw connected segments, skipping gaps.
          const segs: string[] = [];
          let cur = "";
          for (const p of pts) {
            if (p == null) { if (cur) { segs.push(cur); cur = ""; } continue; }
            cur += `${cur ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
          }
          if (cur) segs.push(cur);
          return (
            <g key={s.label}>
              {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)}
              {pts.map((p, i) => (p == null ? null : <circle key={i} cx={p.x} cy={p.y} r="3" fill={s.color} />))}
            </g>
          );
        })}
        {markers && series[0] && markers.map((m) => {
          const p = series[0].points[m.index];
          if (p == null) return null;
          return <circle key={`${m.kind}-${m.index}`} cx={x(m.index)} cy={y(p)} r="5" fill="none" strokeWidth="2" stroke={m.kind === "best" ? "#10b981" : "#f43f5e"} />;
        })}
        {showValues && series[0] && series[0].points.map((p, i) => (
          p == null ? null : <text key={i} x={x(i)} y={y(p) - 7} textAnchor="middle" className="fill-foreground text-[9px] font-medium">{fmt(p)}</text>
        ))}
        {categories.map((c, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">{c}</text>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="mt-1 flex justify-center gap-4">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
