import * as React from "react";
import { cva } from "class-variance-authority";

import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

const iconTileVariants = cva(
  "aapm-icon-tile relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-transparent transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border/60 bg-surface-inset text-muted-foreground",
        green: "border-tint-green-border/60 bg-tint-green text-tint-green-foreground",
        lime: "border-tint-lime-border/70 bg-tint-lime text-tint-lime-foreground",
        orange: "border-tint-orange-border/70 bg-tint-orange text-tint-orange-foreground",
        blue: "border-tint-blue-border/70 bg-tint-blue text-tint-blue-foreground",
        violet: "border-tint-violet-border/70 bg-tint-violet text-tint-violet-foreground",
        slate: "border-tint-slate-border/70 bg-tint-slate text-tint-slate-foreground",
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
const IconTile = React.forwardRef(({ className, icon, tone, size, ...props } = {}, ref) => {
  if (!icon) return null;
  const isIconifyName = typeof icon === "string";

  return (
    <span ref={ref} className={cn(iconTileVariants({ tone, size, className }))} {...props}>
      {isIconifyName ? <AapmIcon name={icon} /> : React.createElement(icon, { "aria-hidden": true })}
    </span>
  );
});

IconTile.displayName = "IconTile";

export { IconTile, iconTileVariants };
