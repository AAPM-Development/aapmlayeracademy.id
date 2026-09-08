import React from "react";
import { cn } from "@/lib/utils";

export default function ContentContainer({ children = null, className = "", ...props } = {}) {
  return (
    <div className={cn("mx-auto min-w-0 w-full max-w-[var(--t7-content-max)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10", className)} data-t7-rail="application" {...props}>
      {children}
    </div>
  );
}
