import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"
import useScrollEdgeFade from "@/lib/useScrollEdgeFade"

const ScrollArea = React.forwardRef(({ className, children, viewportRef = null, ...props }, ref) => (
  <ScrollAreaWithEdgeFade
    className={className}
    forwardedRef={ref}
    viewportRef={viewportRef}
    {...props}
  >
    {children}
  </ScrollAreaWithEdgeFade>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

function setRef(ref, value) {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

function ScrollAreaWithEdgeFade({
  className,
  forwardedRef,
  viewportRef,
  children,
  ...props
}) {
  const rootRef = React.useRef(null)
  const hasEdgeFade =
    typeof className === "string" && className.includes("aapm-scroll-fade")
  const viewportEdgeRef = useScrollEdgeFade({
    stateRef: rootRef,
    enabled: hasEdgeFade,
  })

  const setRootRef = React.useCallback(
    (node) => {
      rootRef.current = node
      setRef(forwardedRef, node)
    },
    [forwardedRef],
  )
  const setViewportRef = React.useCallback(
    (node) => {
      setRef(viewportEdgeRef, node)
      setRef(viewportRef, node)
    },
    [viewportEdgeRef, viewportRef],
  )

  return (
    <ScrollAreaPrimitive.Root
      ref={setRootRef}
      className={cn("relative overflow-hidden", className)}
      {...props}>
      <ScrollAreaPrimitive.Viewport
        ref={setViewportRef}
        className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

const ScrollBar = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/80 hover:bg-brand-orange/60" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
