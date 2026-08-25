import React, { useState } from "react";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

const LearningSheetContent = /** @type {any} */ (SheetContent);
const LearningSheetHeader = /** @type {any} */ (SheetHeader);
const LearningSheetTitle = /** @type {any} */ (SheetTitle);

export default function LearningFocusShell({ header = null, sidebar = null, children = null, footer = null, className = "" } = {}) {
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>
      {header}
      {sidebar && <div className="mt-6 lg:hidden">
        <Button type="button" variant="soft" className="w-full justify-between" aria-expanded={mapOpen} aria-controls="mobile-lesson-map" onClick={() => setMapOpen(true)}>
          <span className="inline-flex items-center gap-2"><AapmIcon name="solar:sidebar-minimalistic-bold-duotone" className="h-4 w-4" /> Buka peta materi</span>
          <span className="text-xs text-muted-foreground">Navigasi materi</span>
        </Button>
        <Sheet open={mapOpen} onOpenChange={setMapOpen}>
          <LearningSheetContent id="mobile-lesson-map" side="right" className="w-[min(90vw,360px)] p-0">
            <LearningSheetHeader className="sr-only"><LearningSheetTitle>Peta materi</LearningSheetTitle></LearningSheetHeader>
            <div className="h-full overflow-y-auto p-4 pt-14">{sidebar}</div>
          </LearningSheetContent>
        </Sheet>
      </div>}
      <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <section className="min-w-0">{children}</section>
        {sidebar && <aside className="hidden lg:block">{sidebar}</aside>}
      </div>
      {footer}
    </div>
  );
}
