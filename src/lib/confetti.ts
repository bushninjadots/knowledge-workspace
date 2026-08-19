// Lightweight, dependency-free confetti burst. Used to celebrate badge awards
// without pulling in a full confetti library.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle";
  life: number;
  maxLife: number;
};

const COLORS = [
  "var(--brand-purple, #7c3aed)",
  "var(--brand-green, #10b981)",
  "var(--user-accent, #6366f1)",
  "#f59e0b",
  "#ec4899",
  "#22d3ee",
];

export function burstConfetti(opts?: { count?: number; origin?: { x: number; y: number } }) {
  if (typeof window === "undefined") return;
  const count = opts?.count ?? 120;
  const origin = opts?.origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    canvas.remove();
    return;
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const particles: Particle[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 10;
    const maxLife = 60 + Math.random() * 60;
    return {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      life: 0,
      maxLife,
    };
  });

  let raf = 0;
  const gravity = 0.22;
  const drag = 0.985;

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const p of particles) {
      p.life++;
      if (p.life >= p.maxLife) continue;
      alive = true;

      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(alpha, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (alive) {
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  }

  raf = requestAnimationFrame(frame);
}
