// @ts-nocheck
import { Skeleton as T7Skeleton } from "@ten4seven/ui"
import { cn } from "@/lib/utils"

/** Skeleton uses the canonical shimmer and respects the existing size classes. */
function Skeleton({ className = "", ...props } = {}) {
  return (
    <T7Skeleton
      className={cn("aapm-t7-skeleton-compat", className)}
      data-t7-bridge="academy-skeleton"
      {...props}
    />
  )
}

export { Skeleton }
