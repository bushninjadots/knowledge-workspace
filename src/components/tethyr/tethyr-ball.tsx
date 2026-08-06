import { useEffect, useRef, useState } from "react";

interface TethyrBallProps {
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Tethyr Ball — the signature loading animation.
 *
 * A tether ball orbits a pole continuously — smooth, fluid, infinite.
 * No phases, no resets, no jumps. Just a ball swinging around a pole
 * with orbital particles, a fading trail, and a breathing glow.
 */
export function TethyrBall({ onComplete, size = "md", className = "" }: TethyrBallProps) {
  const sizeMap = { sm: 80, md: 120, lg: 160 };
  const px = sizeMap[size];
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const firedRef = useRef(false);

  const [tick, setTick] = useState(0);
  // Animation is client-only: driving SVG attrs from state during hydration
  // makes the server markup and client markup disagree.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    function loop(ts: number) {
      if (!startRef.current) startRef.current = ts;
      setTick(ts - startRef.current);
      if (!firedRef.current && ts - startRef.current > 3000) {
        firedRef.current = true;
        onComplete?.();
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onComplete, mounted]);

  const t = tick * 0.001; // seconds

  // Ball orbits the pole — angle increases forever, no modulo, no reset
  const angle = t * 1.8; // radians per second — slow, graceful orbit
  const orbitRadius = 32;

  // Ball position — orbit around the pole top
  const poleX = 60;
  const poleY = 22;
  const cx = poleX + Math.sin(angle) * orbitRadius;
  const cy = poleY + Math.cos(angle) * orbitRadius * 0.55; // elliptical — more horizontal

  // Breathing glow — independent of orbit, slow pulse
  const glowOpacity = 0.25 + Math.sin(t * 1.2) * 0.15;

  // Ball subtle scale breathe
  const ballScale = 1 + Math.sin(t * 1.2) * 0.06;

  // Orbital particles — orbit the ball at their own speed
  const p1Angle = t * 4.5;
  const p2Angle = t * 3.2 + Math.PI;
  const orbR = 13;

  // Trail
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  useEffect(() => {
    trailRef.current.push({ x: cx, y: cy });
    if (trailRef.current.length > 14) trailRef.current.shift();
  }, [cx, cy]);

  if (!mounted) {
    return (
      <div
        className={`relative flex items-center justify-center ${className}`}
        style={{ width: px, height: px }}
        role="img"
        aria-label="Tethyr loading"
      />
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      role="img"
      aria-label="Tethyr loading"
    >
      <svg viewBox="0 0 120 120" className="h-full w-full" fill="none" overflow="visible">
        <defs>
          <linearGradient id="ball-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-green)" />
            <stop offset="100%" stopColor="var(--brand-purple)" />
          </linearGradient>
          <radialGradient id="ambient-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="var(--brand-purple)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient glow — breathes slowly */}
        <circle cx={cx} cy={cy} r="40" fill="url(#ambient-glow)" opacity={glowOpacity} />

        {/* Central pole */}
        <line
          x1={poleX}
          y1={poleY - 2}
          x2={poleX}
          y2="100"
          stroke="oklch(0.4 0.015 260)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />
        <circle cx={poleX} cy={poleY} r="3" fill="oklch(0.5 0.015 260)" opacity="0.6" />

        {/* Trail — fading afterimages */}
        {trailRef.current.map((pt, i) => {
          const frac = (i + 1) / trailRef.current.length;
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={3 + frac * 4}
              fill="url(#ball-grad)"
              opacity={frac * 0.12}
            />
          );
        })}

        {/* Tether line */}
        <line
          x1={poleX}
          y1={poleY}
          x2={cx}
          y2={cy}
          stroke="oklch(0.5 0.015 260)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* The ball */}
        <circle cx={cx} cy={cy} r={8 * ballScale} fill="url(#ball-grad)" filter="url(#glow)" />

        {/* Inner highlight */}
        <circle cx={cx - 2} cy={cy - 2} r={2.5 * ballScale} fill="oklch(1 0 0 / 0.35)" />

        {/* Orbital particles */}
        <circle
          cx={cx + Math.cos(p1Angle) * orbR}
          cy={cy + Math.sin(p1Angle) * orbR * 0.55}
          r="2"
          fill="var(--brand-green)"
          opacity="0.65"
        />
        <circle
          cx={cx + Math.cos(p2Angle) * (orbR * 0.75)}
          cy={cy + Math.sin(p2Angle) * (orbR * 0.75) * 0.55}
          r="1.5"
          fill="var(--brand-purple)"
          opacity="0.55"
        />
        {/* Tiny sparkle */}
        <circle
          cx={cx + Math.cos(p1Angle + 1.5) * (orbR + 5)}
          cy={cy + Math.sin(p1Angle + 1.5) * (orbR + 5) * 0.5}
          r="0.8"
          fill="var(--brand-green)"
          opacity={0.25 + Math.sin(t * 2.5) * 0.25}
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
      <p className="mt-6 text-sm text-muted-foreground animate-pulse">Entering the network…</p>
    </div>
  );
}
