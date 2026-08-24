// @ts-nocheck
import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * HeroUI-inspired icon action: a consistent touch target, explicit label,
 * and a tooltip wherever a text label is not visible.
 */
const IconButton = React.forwardRef(({
  label,
  tooltip = label,
  children,
  variant = "ghost",
  size = "icon",
  ...props
}, ref) => (
  <TooltipProvider delayDuration={250}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={ref} type="button" variant={variant} size={size} aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
));

IconButton.displayName = "IconButton";

export { IconButton };
