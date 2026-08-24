import React from "react";
import { cn } from "@/lib/utils";

export default function AssessmentFocusShell({ header = null, sidebar = null, children = null, footer = null, className = "" } = {}) {
  return (
    <div className={cn("mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>
      {header}
      <div className={cn("mt-6 grid min-w-0 gap-8", sidebar ? "lg:grid-cols-[minmax(0,1fr)_220px]" : "lg:grid-cols-[minmax(0,800px)] lg:justify-center")}>
        <section className="min-w-0">{children}</section>
        {sidebar && <aside className="order-first lg:order-last">{sidebar}</aside>}
      </div>
      {footer}
    </div>
  );
}
