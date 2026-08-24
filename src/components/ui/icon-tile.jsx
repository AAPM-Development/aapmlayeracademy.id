import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconTileVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-xl transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-surface-inset text-muted-foreground",
        green: "bg-tint-green text-tint-green-foreground",
        orange: "bg-tint-orange text-tint-orange-foreground",
        blue: "bg-tint-blue text-tint-blue-foreground",
        violet: "bg-tint-violet text-tint-violet-foreground",
        slate: "bg-tint-slate text-tint-slate-foreground",
      },
      size: {
        sm: "h-8 w-8 [&_svg]:size-4",
        md: "h-10 w-10 [&_svg]:size-[18px]",
        lg: "h-12 w-12 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

/** @type {any} */
const IconTile = React.forwardRef(({ className, icon: Icon, tone, size, ...props } = {}, ref) => {
  if (!Icon) return null;

  return (
    <span ref={ref} className={cn(iconTileVariants({ tone, size, className }))} {...props}>
      <Icon aria-hidden="true" />
    </span>
  );
});

IconTile.displayName = "IconTile";

export { IconTile, iconTileVariants };
