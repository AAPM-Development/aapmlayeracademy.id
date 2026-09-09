// @ts-nocheck
import { Progress as T7Progress } from "@ten4seven/ui"
import { cn } from "@/lib/utils"

/** Progress keeps the existing value/max API and adopts the T7 state track. */
/** @type {any} */
const Progress = ({ className, value, max = 100, ...props } = {}) => (
  <T7Progress
    value={value}
    max={max}
    className={cn("aapm-t7-progress-compat", className)}
    data-t7-bridge="academy-progress"
    {...props}
  />
)

Progress.displayName = "Progress"

export { Progress }
