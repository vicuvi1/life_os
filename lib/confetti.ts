// Dependency-free confetti burst. Spawns a full-screen canvas, animates a
// short physics burst, then removes itself. Respects reduced-motion.

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
}

export function celebrate(opts?: { x?: number; y?: number; count?: number }): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const ox = opts?.x ?? window.innerWidth / 2;
  const oy = opts?.y ?? window.innerHeight * 0.32;
  const n = opts?.count ?? 130;

  const pieces: Piece[] = Array.from({ length: n }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4,
      life: 1,
    };
  });

  let frame = 0;
  function tick() {
    frame++;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.vy += 0.16; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life -= 0.008;
      if (p.life > 0 && p.y < canvas.height + 24) {
        alive = true;
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      }
    }
    if (alive && frame < 220) requestAnimationFrame(tick);
    else canvas.remove();
  }
  requestAnimationFrame(tick);
}
