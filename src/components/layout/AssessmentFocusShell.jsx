import React from "react";
import { cn } from "@/lib/utils";

export default function AssessmentFocusShell({ header = null, sidebar = null, children = null, footer = null, className = "" } = {}) {
  return (
    <div className={cn("mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9", className)}>
      <div className="min-w-0">{header}</div>
      <div className={cn("mt-5 grid min-w-0 gap-5 lg:mt-6 lg:gap-7", sidebar ? "lg:grid-cols-[minmax(0,1fr)_236px]" : "lg:grid-cols-[minmax(0,800px)] lg:justify-center")}>
        <section className="min-w-0">{children}</section>
        {sidebar && <aside className="order-first min-w-0 lg:order-last lg:sticky lg:top-5 lg:self-start">{sidebar}</aside>}
      </div>
      {footer}
    </div>
  );
}
