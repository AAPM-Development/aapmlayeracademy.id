// @ts-nocheck
import { cn } from "@/lib/utils"

/** @param {{ className?: string, [key: string]: any }} props */
function Skeleton({
  className = "",
  ...props
} = {}) {
  return (
    (<div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props} />)
  );
}

export { Skeleton }
