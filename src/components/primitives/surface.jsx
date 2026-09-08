// @ts-nocheck
import { cva } from "class-variance-authority"

import { Surface as T7Surface } from "@ten4seven/ui"
import { cn } from "@/lib/utils"

const surfaceVariants = cva("t7-surface", {
  variants: {
    variant: {
      default: "aapm-t7-surface-base",
      muted: "aapm-t7-surface-subtle",
      accent: "aapm-t7-surface-accent",
      inverse: "aapm-t7-surface-inverse",
      interactive: "aapm-t7-surface-interactive",
      selected: "aapm-t7-surface-selected",
    },
    tone: {
      neutral: "",
      green: "",
      lime: "",
      orange: "",
      blue: "",
      violet: "",
      slate: "",
    },
  },
  defaultVariants: { variant: "default", tone: "neutral" },
})

const semanticToneByLegacyTone = {
  neutral: "base",
  green: "success",
  lime: "accent",
  orange: "warning",
  blue: "info",
  violet: "accent",
  slate: "subtle",
}

const semanticToneByVariant = {
  default: "base",
  muted: "subtle",
  accent: "accent",
  inverse: "base",
  interactive: "base",
  selected: "accent",
}

/**
 * Surface is now rendered by Ten4Seven. Legacy `variant`/`tone` values are
 * translated to the canonical surface vocabulary so feature code and its
 * business state remain unchanged during migration.
 */
/** @type {any} */
const Surface = function Surface({
  as = "div",
  className,
  variant = "default",
  tone = "neutral",
  ...props
} = {}) {
  const semanticTone =
    semanticToneByLegacyTone[tone] || semanticToneByVariant[variant] || "base"
  const emphasis =
    variant === "inverse"
      ? "inverse"
      : variant === "accent" ||
          variant === "selected" ||
          tone !== "neutral"
        ? "soft"
        : undefined

  return (
    <T7Surface
      as={as}
      tone={semanticTone}
      emphasis={emphasis}
      className={cn(surfaceVariants({ variant, tone }), className)}
      data-t7-bridge="academy-surface"
      data-legacy-variant={variant}
      data-legacy-tone={tone}
      {...props}
    />
  )
}

export { Surface, surfaceVariants }
