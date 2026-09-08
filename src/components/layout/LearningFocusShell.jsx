import React, { useState } from "react";
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";

const LearningSheetContent = /** @type {any} */ (SheetContent);
const LearningSheetHeader = /** @type {any} */ (SheetHeader);
const LearningSheetTitle = /** @type {any} */ (SheetTitle);

export default function LearningFocusShell({ header = null, sidebar = null, children = null, footer = null, className = "" } = {}) {
  const [mapOpen, setMapOpen] = useState(false);
  const mapScrollRef = useScrollEdgeFade();

  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>
      {header}
      {sidebar && <div className="mt-6 lg:hidden">
        <Button type="button" variant="soft" className="w-full justify-between gap-3 text-left [&>.t7-button-label]:flex [&>.t7-button-label]:w-full [&>.t7-button-label]:items-center [&>.t7-button-label]:justify-between" aria-expanded={mapOpen} aria-controls="mobile-lesson-map" onClick={() => setMapOpen(true)}>
          <span className="inline-flex min-w-0 items-center gap-2"><AapmIcon name="solar:sidebar-minimalistic-bold-duotone" className="h-4 w-4 shrink-0" /><span className="truncate">Buka peta materi</span></span>
          <span className="ml-3 shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">Navigasi materi</span>
        </Button>
        <Sheet open={mapOpen} onOpenChange={setMapOpen}>
          <LearningSheetContent id="mobile-lesson-map" side="right" className="w-[min(90vw,360px)] p-0">
            <LearningSheetHeader className="sr-only"><LearningSheetTitle>Peta materi</LearningSheetTitle></LearningSheetHeader>
            <div ref={mapScrollRef} className="aapm-scroll-fade aapm-scroll-fade--subtle aapm-scrollbar h-full overflow-y-auto p-4 pt-14">{sidebar}</div>
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
