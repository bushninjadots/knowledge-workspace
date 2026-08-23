/**
 * Tethyr Icon System
 * Core branded icons for Learn, Teach, Connect, and Grow
 */

export function IconLearn({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M32 18L42 24V42C42 45.3137 37.523 48 32 48C26.477 48 22 45.3137 22 42V24L32 18Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTeach({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M22 42V22H42V42M25 29H39M25 35H39M25 41H35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconConnect({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="27" cy="32" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="37" cy="32" r="10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconGrow({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M32 44V20M20 32H44M28 24L32 20L36 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Logo Infinity Component
export function LogoInfinity({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7CFF6E" />
          <stop offset="100%" stopColor="#5FE64A" />
        </linearGradient>
        <linearGradient id="gradient-purple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A64DFF" />
          <stop offset="100%" stopColor="#8A2BFF" />
        </linearGradient>
        <filter id="logo-breathe">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Breathing glow layer */}
      <g className="animate-[logo-breathe_3s_ease-in-out_infinite]" opacity="0.35">
        <path
          d="M30 60C30 46.745 39.059 36 50 36C62.702 36 72 45.373 72 60C72 74.627 62.702 84 50 84C39.059 84 30 73.255 30 60Z"
          fill="url(#gradient-green)"
          filter="url(#logo-breathe)"
        />
        <path
          d="M48 60C48 46.745 57.059 36 68 36C80.702 36 90 45.373 90 60C90 74.627 80.702 84 68 84C57.059 84 48 73.255 48 60Z"
          fill="url(#gradient-purple)"
          filter="url(#logo-breathe)"
        />
      </g>

      {/* Left loop - Green */}
      <g>
        <path
          d="M30 60C30 46.745 39.059 36 50 36C62.702 36 72 45.373 72 60C72 74.627 62.702 84 50 84C39.059 84 30 73.255 30 60Z"
          fill="url(#gradient-green)"
        />
        <circle cx="42" cy="30" r="6" fill="url(#gradient-green)" />
      </g>

      {/* Right loop - Purple */}
      <g>
        <path
          d="M48 60C48 46.745 57.059 36 68 36C80.702 36 90 45.373 90 60C90 74.627 80.702 84 68 84C57.059 84 48 73.255 48 60Z"
          fill="url(#gradient-purple)"
        />
        <circle cx="88" cy="30" r="6" fill="url(#gradient-purple)" />
      </g>
    </svg>
  );
}

// Icon variants for different use cases
export function IconLearnCompact({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3L4 7V13C4 17.418 12 21 12 21S20 17.418 20 13V7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTeachCompact({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 5H20V19H4V5ZM7 9H17M7 13H14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconConnectCompact({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconGrowCompact({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 18V6M6 12H18M12 6L10 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
