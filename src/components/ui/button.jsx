// @ts-nocheck
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { Button as T7Button } from "@ten4seven/ui"
import { cn } from "@/lib/utils"

// Compatibility surface for existing Academy call sites. The rendered
// control is Ten4Seven-owned; these classes only keep Radix Slot consumers
// (dialog/calendar/pagination) on the same semantic token contract.
const buttonVariants = cva(
  "t7-button",
  {
    variants: {
      variant: {
        default: "aapm-t7-button-primary",
        destructive: "aapm-t7-button-danger",
        outline: "aapm-t7-button-secondary",
        secondary: "aapm-t7-button-secondary",
        soft: "aapm-t7-button-quiet",
        ghost: "aapm-t7-button-quiet",
        link: "aapm-t7-button-link",
      },
      size: {
        default: "aapm-t7-button-md",
        sm: "aapm-t7-button-sm",
        lg: "aapm-t7-button-lg",
        icon: "aapm-t7-button-icon",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

const intentByVariant = {
  default: "primary",
  destructive: "danger",
  outline: "secondary",
  secondary: "secondary",
  soft: "quiet",
  ghost: "quiet",
  link: "quiet",
}

const canonicalSizeByVariant = {
  default: "md",
  sm: "sm",
  lg: "lg",
  icon: "sm",
}

/**
 * Preserve the established Button API while moving normal buttons onto the
 * canonical Ten4Seven interaction and token contract. `asChild` remains a
 * narrow Radix compatibility path because the canonical Button intentionally
 * renders a native button and does not expose an `asChild` prop.
 */
/** @type {any} */
const Button = React.forwardRef(({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  ...props
} = {}, ref) => {
  const intent = intentByVariant[variant] || "primary"
  const canonicalSize = canonicalSizeByVariant[size] || "md"

  if (asChild) {
    return (
      <Slot
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        data-intent={intent}
        data-loading={loading || undefined}
        data-size={canonicalSize}
        aria-busy={loading || undefined}
        {...props}
      />
    )
  }

  return (
    <T7Button
      ref={ref}
      intent={intent}
      size={canonicalSize}
      loading={loading}
      className={cn(size === "icon" && "aapm-t7-button-icon", className)}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
