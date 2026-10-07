import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = ({ delayDuration = 300, skipDelayDuration = 200, ...props }) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
);

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn("aapm-tooltip", className)} {...props} />
    </TooltipPrimitive.Portal>
  );
});

/**
 * `<Tooltip content="…">{trigger}</Tooltip>` is the short form; without
 * `content` it is the Radix root for the composed Trigger/Content API.
 */
function Tooltip({ content, side = "top", align = "center", children, ...props }) {
  if (content === undefined) {
    return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
  }

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} align={align}>{content}</TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
