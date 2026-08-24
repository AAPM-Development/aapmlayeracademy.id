import React from "react";
import { cn } from "@/lib/utils";

export default function LearningFocusShell({ header = null, sidebar = null, children = null, footer = null, className = "" } = {}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>
      {header}
      <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <section className="min-w-0">{children}</section>
        {sidebar && <aside className="order-first lg:order-last">{sidebar}</aside>}
      </div>
      {footer}
    </div>
  );
}
