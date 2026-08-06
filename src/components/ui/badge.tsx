import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[11px] font-medium leading-5 transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-sunken text-muted-foreground",
        secondary: "border-border bg-surface text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        solid: "border-primary bg-primary text-primary-foreground",
        trust: "border-transparent bg-trust-subtle text-trust",
        learning: "border-transparent bg-learning-subtle text-learning",
        teaching: "border-transparent bg-teaching-subtle text-teaching",
        ai: "border-transparent bg-ai-subtle text-ai",
        warning: "border-transparent bg-warning-subtle text-warning",
        destructive: "border-transparent bg-warning-subtle text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
