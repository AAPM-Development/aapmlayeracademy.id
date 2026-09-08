// @ts-nocheck
import * as React from "react"
import { cva } from "class-variance-authority"

import { Badge as T7Badge } from "@ten4seven/ui"
import { cn } from "@/lib/utils"

const badgeVariants = cva("t7-badge inline-flex items-center gap-1.5", {
  variants: {
    variant: {
      default: "aapm-t7-badge-primary",
      secondary: "aapm-t7-badge-neutral",
      destructive: "aapm-t7-badge-danger",
      outline: "aapm-t7-badge-neutral",
      soft: "aapm-t7-badge-neutral",
      success: "aapm-t7-badge-success",
      warning: "aapm-t7-badge-warning",
      info: "aapm-t7-badge-info",
      ai: "aapm-t7-badge-accent",
    },
  },
  defaultVariants: { variant: "default" },
})

const toneByVariant = {
  default: "primary",
  secondary: "neutral",
  destructive: "danger",
  outline: "neutral",
  soft: "neutral",
  success: "success",
  warning: "warning",
  info: "neutral",
  ai: "primary",
}

/** Badge compatibility wrapper backed by the canonical status vocabulary. */
/** @type {any} */
const Badge = React.forwardRef(({
  className,
  variant = "default",
  ...props
} = {}, ref) => (
  <T7Badge
    ref={ref}
    tone={toneByVariant[variant] || "neutral"}
    className={cn(badgeVariants({ variant }), className)}
    data-t7-bridge="academy-badge"
    {...props}
  />
))

Badge.displayName = "Badge"

export { Badge, badgeVariants }
