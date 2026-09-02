import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EDITOR_CHROME_CLASS = "studio-editor-chrome";

/**
 * Keeps editor controls readable when the creator chooses a strong Studio
 * accent or appearance. The child canvas remains outside this boundary.
 */
export function EditorChromeBoundary({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(EDITOR_CHROME_CLASS, className)} data-editor-chrome>
      {children}
    </div>
  );
}
