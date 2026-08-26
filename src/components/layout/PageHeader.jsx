import React from "react";
import { cn } from "@/lib/utils";

export default function PageHeader({ eyebrow = "", title = "", description = "", actions = null, className = "" } = {}) {
  return (
    <div className={cn("mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-brand-orange"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-orange" />{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}
