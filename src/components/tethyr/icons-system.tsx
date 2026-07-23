/**
 * Tethyr Icon System
 * Core branded icons for Learn, Teach, Connect, and Grow
 */

export function IconLearn({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" />
      <path
        d="M32 16L44 24V42C44 45.3137 38.627 48 32 48C25.373 48 20 45.3137 20 42V24L32 16Z"
        fill="currentColor"
      />
      <circle cx="32" cy="36" r="2" fill="white" />
    </svg>
  );
}

export function IconTeach({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 42V20H44V42M24 28H40M24 34H40M24 40H36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconConnect({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Infinity symbol representing connection */}
      <path
        d="M20 32C20 26.477 23.582 22 28 22C33.523 22 38 27.373 38 32C38 36.627 33.523 42 28 42C23.582 42 20 37.523 20 32ZM44 32C44 26.477 47.582 22 52 22C57.523 22 62 27.373 62 32C62 36.627 57.523 42 52 42C47.582 42 44 37.523 44 32Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconGrow({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" />
      <path
        d="M32 44V20M20 32H44M28 24L32 20L36 24"
        stroke="currentColor"
        strokeWidth="2"
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
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2L4 6V12C4 17.5 12 22 12 22S20 17.5 20 12V6L12 2Z" />
      <circle cx="12" cy="13" r="1.5" fill="white" />
    </svg>
  );
}

export function IconTeachCompact({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="4" width="18" height="14" rx="1" />
      <line x1="6" y1="9" x2="18" y2="9" stroke="white" strokeWidth="1" />
      <line x1="6" y1="13" x2="14" y2="13" stroke="white" strokeWidth="1" />
    </svg>
  );
}

export function IconConnectCompact({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7 12C7 9.243 8.805 7 11 7C13.627 7 15.5 8.925 15.5 12C15.5 15.075 13.627 17 11 17C8.805 17 7 14.757 7 12ZM16.5 12C16.5 9.243 18.305 7 20.5 7C23.127 7 25 8.925 25 12C25 15.075 23.127 17 20.5 17C18.305 17 16.5 14.757 16.5 12Z" />
    </svg>
  );
}

export function IconGrowCompact({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 18V6M6 12H18M12 6L10 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
