// @ts-nocheck
import React from "react"

import { IconButton as T7IconButton, IconNames } from "@ten4seven/ui"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { aapmSemanticIconNames } from "@/components/icons/AapmIcon"

// Keep the special legacy logout affordance local: the canonical registry has
// no logout glyph yet, while all other names share AapmIcon's bridge.
const semanticIconByAapmName = {
  ...aapmSemanticIconNames,
  logout: "arrowLeft",
}

const intentByVariant = {
  default: "secondary",
  outline: "secondary",
  secondary: "secondary",
  ghost: "quiet",
  soft: "quiet",
  destructive: "danger",
}

const sizeByVariant = {
  icon: "md",
  sm: "sm",
  md: "md",
  lg: "lg",
}

function resolveSemanticIcon(children) {
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child)) continue
    const name = child.props?.name
    if (typeof name !== "string") continue
    if (semanticIconByAapmName[name]) return semanticIconByAapmName[name]
    if (IconNames.includes(name)) return name

    const raw = name.toLowerCase()
    if (raw.includes("camera") || raw.includes("gallery")) return "image"
    if (raw.includes("danger")) return "danger"
    if (raw.includes("check")) return "check"
    if (raw.includes("close")) return "close"
    if (raw.includes("arrow-left")) return "arrowLeft"
    if (raw.includes("arrow-right")) return "arrowRight"
    if (raw.includes("download")) return "download"
    if (raw.includes("upload")) return "upload"
    if (raw.includes("search")) return "search"
    if (raw.includes("edit") || raw.includes("pen")) return "edit"
    if (raw.includes("trash")) return "delete"
  }

  return "more"
}

/**
 * Keep the established tooltip/variant API while delegating the actual icon
 * button interaction to Ten4Seven. Unknown legacy glyphs intentionally fall
 * back to the canonical `more` semantic icon instead of leaking a provider
 * string into the new primitive contract.
 */
/** @type {any} */
const IconButton = React.forwardRef(({
  label,
  tooltip = label,
  children,
  variant = "ghost",
  size = "icon",
  ...props
}, ref) => {
  const intent = intentByVariant[variant] || "quiet"
  const canonicalSize = sizeByVariant[size] || "md"
  const semanticIcon = resolveSemanticIcon(children)
  const control = (
    <T7IconButton
      ref={ref}
      label={label || tooltip || "Action"}
      intent={intent}
      size={canonicalSize}
      icon={semanticIcon}
      className={props.className}
      {...props}
    />
  )

  if (!tooltip) return control

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

IconButton.displayName = "IconButton"

export { IconButton }
