import { useState, useEffect } from "react";

interface TethyrBallProps {
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TethyrBall({ onComplete, size = "md", className = "" }: TethyrBallProps) {
  const [phase, setPhase] = useState<"swinging" | "wrapping" | "done">("swinging");

  const sizeMap = { sm: 80, md: 120, lg: 160 };
  const px = sizeMap[size];

  useEffect(() => {
    const swingTimer = setTimeout(() => setPhase("wrapping"), 1800);
    const doneTimer = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 3000);
    return () => {
      clearTimeout(swingTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

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
          <filter id="ball-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Central pole */}
        <line
          x1="60"
          y1="20"
          x2="60"
          y2="100"
          stroke="oklch(0.4 0.015 260)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Pole cap */}
        <circle cx="60" cy="20" r="3" fill="oklch(0.5 0.015 260)" />

        {/* Tether line */}
        <line
          x1="60"
          y1="20"
          className={
            phase === "swinging" ? "origin-[60px_20px] animate-[swing_1.8s_ease-in-out]" : ""
          }
          x2={phase === "done" ? "60" : "85"}
          y2={phase === "done" ? "35" : "55"}
          stroke="oklch(0.5 0.015 260)"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            transition: phase === "wrapping" ? "all 1s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
        />

        {/* The ball */}
        <circle
          cx={phase === "done" ? "60" : "85"}
          cy={phase === "done" ? "35" : "55"}
          r="8"
          fill="url(#ball-gradient)"
          filter="url(#ball-glow)"
          className={
            phase === "swinging" ? "origin-[60px_20px] animate-[swing_1.8s_ease-in-out]" : ""
          }
          style={{
            transition: phase === "wrapping" ? "all 1s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
        />

        {/* Inner highlight on ball */}
        <circle
          cx={phase === "done" ? "58" : "83"}
          cy={phase === "done" ? "33" : "53"}
          r="2.5"
          fill="oklch(1 0 0 / 0.4)"
          style={{
            transition: phase === "wrapping" ? "all 1s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
        />

        {/* Completion pulse */}
        {phase === "done" && (
          <circle
            cx="60"
            cy="35"
            r="8"
            fill="none"
            stroke="url(#ball-gradient)"
            strokeWidth="1.5"
            className="animate-ping"
            style={{ animationDuration: "1s" }}
            opacity="0.5"
          />
        )}
      </svg>

      <style>{`
        @keyframes swing {
          0% { transform: rotate(-25deg); }
          50% { transform: rotate(25deg); }
          100% { transform: rotate(-25deg); }
        }
      `}</style>
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
