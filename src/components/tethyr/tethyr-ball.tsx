import { useState, useEffect, useRef, useCallback } from "react";

interface TethyrBallProps {
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Tethyr Ball — the signature loading animation.
 *
 * A tether ball swings on a pole, wraps around it with a spiral,
 * pulses with a breathing glow, then resets and loops.
 * Small orbital particles circle the ball throughout.
 */
export function TethyrBall({ onComplete, size = "md", className = "" }: TethyrBallProps) {
  const sizeMap = { sm: 80, md: 120, lg: 160 };
  const px = sizeMap[size];
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const loopCountRef = useRef(0);

  // Phase durations (ms)
  const SWING_DUR = 2000;
  const WRAP_DUR = 1200;
  const PULSE_DUR = 800;
  const PAUSE_DUR = 600;
  const CYCLE = SWING_DUR + WRAP_DUR + PULSE_DUR + PAUSE_DUR;

  const [tick, setTick] = useState(0);

  const animate = useCallback(
    (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = elapsed % CYCLE;
      setTick(t);

      if (elapsed > CYCLE * (loopCountRef.current + 1)) {
        loopCountRef.current += 1;
        onComplete?.();
      }

      rafRef.current = requestAnimationFrame(animate);
    },
    [onComplete],
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // Derive phase + interpolation from tick
  const phase: "swing" | "wrap" | "pulse" | "pause" =
    tick < SWING_DUR
      ? "swing"
      : tick < SWING_DUR + WRAP_DUR
        ? "wrap"
        : tick < SWING_DUR + WRAP_DUR + PULSE_DUR
          ? "pulse"
          : "pause";

  const swingT = tick / SWING_DUR; // 0→1 over swing phase
  const wrapT = Math.min(1, (tick - SWING_DUR) / WRAP_DUR); // 0→1 over wrap phase
  const pulseT = Math.min(1, (tick - SWING_DUR - WRAP_DUR) / PULSE_DUR);

  // Swing: sinusoidal pendulum angle
  const swingAngle = Math.sin(swingT * Math.PI * 2) * 30; // -30° to +30°

  // Wrap: spiral the ball toward the pole center
  const wrapAngle = swingAngle * (1 - wrapT) + 0 * wrapT;
  const wrapRadius = 35 * (1 - wrapT * 0.65); // shrink tether length
  const ballX = 60 + Math.sin((wrapAngle * Math.PI) / 180) * wrapRadius;
  const ballY = 20 + Math.cos((wrapAngle * Math.PI) / 180) * wrapRadius;

  // During swing, use the animated angle; during wrap, interpolate to final position
  let cx: number, cy: number;
  if (phase === "swing") {
    cx = 60 + Math.sin((swingAngle * Math.PI) / 180) * 35;
    cy = 20 + Math.cos((swingAngle * Math.PI) / 180) * 35;
  } else {
    cx = ballX;
    cy = ballY;
  }

  // Pulse glow opacity
  const glowOpacity =
    phase === "pulse" ? 0.3 + pulseT * 0.5 : phase === "pause" ? 0.8 * (1 - pulseT) : 0.3;

  // Ball scale: slight grow during pulse
  const ballScale =
    phase === "pulse" ? 1 + pulseT * 0.15 : phase === "pause" ? 1.15 * (1 - pulseT * 0.15) : 1;

  // Trail points: record last N ball positions
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  useEffect(() => {
    trailRef.current.push({ x: cx, y: cy });
    if (trailRef.current.length > 12) trailRef.current.shift();
  }, [cx, cy]);

  // Orbital particles — two dots that orbit the ball
  const orb1Angle = (tick / 800) * Math.PI * 2;
  const orb2Angle = (tick / 600) * Math.PI * 2 + Math.PI;
  const orbRadius = phase === "pulse" ? 14 + pulseT * 4 : 14;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      role="img"
      aria-label="Tethyr loading"
    >
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ball-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-green)" />
            <stop offset="100%" stopColor="var(--brand-purple)" />
          </linearGradient>
          <radialGradient id="ball-glow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.6" />
            <stop offset="60%" stopColor="var(--brand-purple)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <filter id="ball-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="soft-glow">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Ambient glow behind everything */}
        <circle cx="60" cy="50" r="40" fill="url(#ball-glow-grad)" opacity={glowOpacity * 0.4} />

        {/* Central pole */}
        <line
          x1="60"
          y1="18"
          x2="60"
          y2="100"
          stroke="oklch(0.4 0.015 260)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Pole cap */}
        <circle cx="60" cy="18" r="3" fill="oklch(0.5 0.015 260)" />

        {/* Trail — fading afterimages of the ball */}
        {trailRef.current.map((pt, i) => {
          const opacity = ((i + 1) / trailRef.current.length) * 0.15;
          const r = 4 + (i / trailRef.current.length) * 3;
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={r}
              fill="url(#ball-gradient)"
              opacity={opacity}
            />
          );
        })}

        {/* Tether line */}
        <line
          x1="60"
          y1="18"
          x2={cx}
          y2={cy}
          stroke="oklch(0.5 0.015 260)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* The ball */}
        <circle
          cx={cx}
          cy={cy}
          r={8 * ballScale}
          fill="url(#ball-gradient)"
          filter="url(#ball-glow)"
        />

        {/* Inner highlight */}
        <circle
          cx={cx - 2 * ballScale}
          cy={cy - 2 * ballScale}
          r={2.5 * ballScale}
          fill="oklch(1 0 0 / 0.35)"
        />

        {/* Pulse ring during pulse phase */}
        {phase === "pulse" && (
          <circle
            cx={cx}
            cy={cy}
            r={8 + pulseT * 18}
            fill="none"
            stroke="url(#ball-gradient)"
            strokeWidth="1.5"
            opacity={0.6 * (1 - pulseT)}
          />
        )}

        {/* Orbital particles */}
        <circle
          cx={cx + Math.cos(orb1Angle) * orbRadius}
          cy={cy + Math.sin(orb1Angle) * orbRadius * 0.6}
          r="2"
          fill="var(--brand-green)"
          opacity="0.7"
        />
        <circle
          cx={cx + Math.cos(orb2Angle) * (orbRadius * 0.8)}
          cy={cy + Math.sin(orb2Angle) * (orbRadius * 0.8) * 0.6}
          r="1.5"
          fill="var(--brand-purple)"
          opacity="0.6"
        />

        {/* Tiny sparkle dots that fade in/out */}
        <circle
          cx={cx + Math.cos(orb1Angle + 1.2) * (orbRadius + 6)}
          cy={cy + Math.sin(orb1Angle + 1.2) * (orbRadius + 6) * 0.5}
          r="0.8"
          fill="var(--brand-green)"
          opacity={0.3 + Math.sin(tick / 300) * 0.3}
        />
      </svg>
    </div>
  );
}

export function TethyrBallFull({ className }: { className?: string }) {
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center bg-background ${className ?? ""}`}
    >
      <TethyrBall size="lg" />
      <p className="mt-6 text-sm text-muted-foreground animate-pulse">Entering the workshop…</p>
    </div>
  );
}
