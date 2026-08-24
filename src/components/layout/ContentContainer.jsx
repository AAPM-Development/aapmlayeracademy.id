import React from "react";
import { cn } from "@/lib/utils";

export default function ContentContainer({ children = null, className = "", ...props } = {}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)} {...props}>
      {children}
    </div>
  );
}
