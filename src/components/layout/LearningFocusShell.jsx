import React from "react";
import { cn } from "@/lib/utils";

export default function LearningFocusShell({ header = null, sidebar = null, children = null, footer = null, className = "" } = {}) {
  return (
    <div className={cn("aapm-token-rail mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)} data-t7-region="learning-rail">
      {header}
      {sidebar && <div className="mt-5 sm:mt-6">{sidebar}</div>}
      <div className="mt-8 min-w-0">
        <section className="min-w-0 max-w-5xl" data-t7-region="learning-content">{children}</section>
      </div>
      {footer}
    </div>
  );
}
