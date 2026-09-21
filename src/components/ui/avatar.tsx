"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, style, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    style={style}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-[var(--avatar-radius,9999px)] [clip-path:var(--avatar-clip)]",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    loading="lazy"
    decoding="async"
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-[var(--avatar-radius,9999px)] bg-muted",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/**
 * Styles for a container that should take the member's profile-picture shape.
 * Spread onto any wrapper (or the Avatar itself) that sits inside a scope
 * carrying `avatarShapeStyle()` variables — radius by default, plus the
 * polygon clip when the member picked an exotic shape.
 */
export const avatarShapeCss = {
  borderRadius: "var(--avatar-radius, 9999px)",
  clipPath: "var(--avatar-clip, none)",
} as const;

/**
 * Ring styles for an avatar whose scope carries `avatarShapeStyle()`
 * variables. Renders nothing when `--avatar-ring` isn't set, so call sites
 * can spread it unconditionally. `--avatar-ring` resolves to a concrete
 * colour (the member's accent or custom pick) set by `avatarShapeStyle()`.
 */
export const avatarRingCss = {
  boxShadow:
    "0 0 0 3px var(--avatar-ring), 0 0 0 4px color-mix(in oklab, var(--avatar-ring) 25%, transparent)",
} as const;

export { Avatar, AvatarImage, AvatarFallback };
