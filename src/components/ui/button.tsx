import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-sm font-semibold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90 hover:border-primary/90 active:bg-primary",
        purple: "bg-ai text-ai-foreground border-ai shadow-sm hover:bg-ai/90 hover:border-ai/90",
        brand:
          "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90 hover:border-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive shadow-sm hover:bg-destructive/90 hover:border-destructive/90",
        outline:
          "border-border-strong bg-surface-elevated text-foreground hover:bg-accent hover:border-user-accent-border",
        secondary:
          "border-border bg-surface text-foreground hover:bg-surface-elevated hover:border-border-strong",
        ghost:
          "border-transparent text-muted-foreground hover:bg-surface-sunken hover:border-border hover:text-foreground",
        link: "border-transparent text-foreground underline-offset-4 hover:text-user-accent hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-xs",
        // 44px — meets the touch-target minimum for primary CTAs, especially on mobile.
        lg: "h-11 px-5",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a non-interactive progress indicator and disables the button. */
  busy?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, busy = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const content = busy ? (
      <>
        <Loader2 aria-hidden="true" className="animate-spin" />
        {children}
      </>
    ) : (
      children
    );
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
