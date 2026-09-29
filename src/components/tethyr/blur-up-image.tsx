import { useState } from "react";
import { cn } from "@/lib/utils";

export function BlurUpImage({
  src,
  alt,
  className,
  placeholderClassName,
  ...props
}: React.ComponentPropsWithoutRef<"img"> & { placeholderClassName?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span
      className={cn(
        "relative block overflow-hidden bg-surface-sunken",
        !loaded && placeholderClassName,
      )}
    >
      <span
        aria-hidden="true"
        // Decorative placeholder: never a click target. Without this it sits
        // above interactive siblings until the image loads and can swallow
        // their clicks (qa-explore-overlay caught it intercepting the overlay's
        // View Project button).
        className={cn(
          "pointer-events-none absolute inset-0 bg-surface-sunken transition-opacity duration-300 ease-out",
          loaded ? "opacity-0" : "opacity-100",
        )}
      />
      <img
        {...props}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(
          "relative transition-opacity duration-300 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </span>
  );
}
