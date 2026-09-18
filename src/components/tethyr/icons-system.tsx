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
