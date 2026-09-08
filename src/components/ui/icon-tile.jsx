import * as React from "react";
import { cva } from "class-variance-authority";

import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

const iconTileVariants = cva(
  "aapm-icon-tile aapm-token-icon relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden border border-transparent",
  {
    variants: {
      tone: {
        neutral: "border-border/60 bg-surface-inset text-muted-foreground",
        green: "border-tint-green-border/60 bg-tint-green text-tint-green-foreground",
        lime: "border-tint-lime-border/70 bg-tint-lime text-tint-lime-foreground",
        orange: "border-tint-orange-border/70 bg-tint-orange text-tint-orange-foreground",
        /* Blue and violet are data/status roles. They remain available for
         * truthful categories instead of being flattened into brand green. */
        blue: "border-tint-blue-border/70 bg-tint-blue text-tint-blue-foreground",
        violet: "border-tint-violet-border/70 bg-tint-violet text-tint-violet-foreground",
        slate: "border-border/60 bg-surface-inset text-muted-foreground",
      },
      size: {
        sm: "h-[var(--icon-tile-size-sm)] w-[var(--icon-tile-size-sm)] [&_svg]:size-[var(--icon-size-status)]",
        md: "h-[var(--icon-tile-size-md)] w-[var(--icon-tile-size-md)] [&_svg]:size-[var(--icon-size-control)]",
        lg: "h-[var(--icon-tile-size-lg)] w-[var(--icon-tile-size-lg)] [&_svg]:size-[var(--icon-size-navigation)]",
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
