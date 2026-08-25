// @ts-nocheck
import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Product-level surface vocabulary. Feature code should choose a semantic
// treatment instead of recreating shadows, tints, and borders ad hoc.
const surfaceVariants = cva(
  "rounded-[var(--card-radius)] border text-foreground transition-[background-color,border-color,box-shadow,transform] duration-200",
  {
    variants: {
      variant: {
        default: "border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-default))] shadow-[var(--surface-shadow)]",
        muted: "border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted))] shadow-none",
        accent: "border-[hsl(var(--surface-accent-border))] bg-[hsl(var(--surface-accent))] shadow-none",
        inverse: "border-foreground bg-foreground text-background shadow-none",
        interactive: "aapm-interactive-card border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-default))] shadow-none focus-within:border-brand-green/45",
        selected: "border-brand-green/50 bg-brand-green/5 shadow-none ring-1 ring-brand-green/10",
      },
      tone: {
        neutral: "",
        green: "border-tint-green-border bg-tint-green",
        lime: "border-tint-lime-border bg-tint-lime",
        orange: "border-tint-orange-border bg-tint-orange",
        blue: "border-tint-blue-border bg-tint-blue",
        violet: "border-tint-violet-border bg-tint-violet",
        slate: "border-tint-slate-border bg-tint-slate",
      },
    },
    defaultVariants: {
      variant: "default",
      tone: "neutral",
    },
  },
);

const Surface = React.forwardRef(({ className, variant, tone, ...props }, ref) => (
  <div ref={ref} className={cn(surfaceVariants({ variant, tone }), className)} {...props} />
));
Surface.displayName = "Surface";

export { Surface, surfaceVariants };
