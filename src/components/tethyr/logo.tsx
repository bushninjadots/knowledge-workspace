import { Link } from "@tanstack/react-router";
import { LogoInfinity } from "./icons-system";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon" | "horizontal";
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", variant = "full", size = "md" }: LogoProps) {
  const sizeMap = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeMap = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-2xl",
  };

  if (variant === "icon") {
    return (
      <Link to="/" className={`inline-flex items-center justify-center ${className}`}>
        <div className="relative">
          <LogoInfinity className={sizeMap[size]} />
        </div>
      </Link>
    );
  }

  if (variant === "horizontal") {
    return (
      <Link to="/" className={`flex items-center gap-3 group ${className}`}>
        <div className="relative">
          <LogoInfinity className={sizeMap[size]} />
        </div>
        <div className="flex flex-col">
          <span
            className={`font-display font-semibold tracking-tight text-foreground ${textSizeMap[size]}`}
          >
            Tethyr
          </span>
          <span className="text-xs text-brand-green font-medium">Connected by what you know</span>
        </div>
      </Link>
    );
  }

  // Default: full variant
  return (
    <Link to="/" className={`flex items-center gap-2 group ${className}`}>
      <div className="relative">
        <LogoInfinity className={sizeMap[size]} />
      </div>
      <span
        className={`font-display font-semibold tracking-tight text-foreground ${textSizeMap[size]}`}
      >
        Tethyr
      </span>
    </Link>
  );
}
