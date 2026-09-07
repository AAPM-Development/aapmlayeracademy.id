// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, Button, Surface } from "@/components/primitives";
import { cn } from "@/lib/utils";

function SectionButton({ section, active, onNavigate, mobile = false, index = 0 }) {
  const description = section.detail ? `${section.label}: ${section.detail}` : section.label;

  return (
    <button
      type="button"
      onClick={() => onNavigate(section.id)}
      aria-current={active ? "step" : undefined}
      aria-label={description}
      title={description}
      data-editor-section-link={section.id}
      className={cn(
        "group flex min-w-0 items-center gap-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mobile ? "shrink-0 px-2 py-1.5" : "px-2 py-1.5",
        active
          ? "bg-tint-orange text-tint-orange-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold leading-none",
          active ? "bg-brand-orange text-white" : "bg-surface-subtle text-muted-foreground group-hover:text-foreground",
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold leading-4">{section.label}</span>
        {!mobile && active && section.detail && <span className="block truncate text-[9px] leading-3 text-muted-foreground">{section.detail}</span>}
      </span>
    </button>
  );
}

export default function EditorQuickNav({
  sections = [],
  activeSection = "",
  onNavigate = () => {},
  onPreview = null,
  onSave = () => {},
  isDirty = false,
  isSaving = false,
}) {
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection));
  const progress = sections.length ? ((activeIndex + 1) / sections.length) * 100 : 0;

  return (
    <>
      <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-hidden rounded-xl border border-border bg-surface-elevated p-1 shadow-sm xl:hidden" aria-label="Akses cepat editor">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-brand-orange" title="Navigasi editor" aria-hidden="true">
          <AapmIcon name="sidebar" className="h-3.5 w-3.5" />
        </div>
        <nav className="aapm-scrollbar flex min-w-0 gap-0.5 overflow-x-auto" aria-label="Bagian editor">
          {sections.map((section, index) => (
            <SectionButton
              key={section.id}
              section={section}
              active={section.id === activeSection}
              onNavigate={onNavigate}
              index={index}
              mobile
            />
          ))}
        </nav>
        {onPreview && (
          <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-lg px-2 text-[11px]" onClick={onPreview} aria-label="Pratinjau learner" title="Pratinjau learner">
            <AapmIcon name="eye" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lihat</span>
          </Button>
        )}
      </div>

      <aside className="hidden xl:col-start-2 xl:row-start-1 xl:block">
        <Surface className="sticky top-5 p-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-tint-orange text-brand-orange" aria-hidden="true">
                <AapmIcon name="sidebar" className="h-3.5 w-3.5" />
              </span>
              <h2 className="truncate text-xs font-semibold">Peta editor</h2>
            </div>
            <Badge variant="soft" className={isDirty ? "bg-tint-orange text-tint-orange-foreground" : "bg-tint-green text-brand-green"}>
              {isDirty ? "Draft" : "Siap"}
            </Badge>
          </div>

          <div className="mt-2 flex items-center gap-2 px-1">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-orange transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="shrink-0 text-[10px] font-semibold text-muted-foreground">
              {sections.length ? activeIndex + 1 : 0}/{sections.length}
            </p>
          </div>

          <nav className="mt-2 space-y-0.5" aria-label="Bagian editor">
            {sections.map((section, index) => (
              <SectionButton
                key={section.id}
                section={section}
                active={section.id === activeSection}
                onNavigate={onNavigate}
                index={index}
              />
            ))}
          </nav>

          <div className={cn("mt-2 grid gap-1.5 border-t border-border pt-2", onPreview ? "grid-cols-2" : "grid-cols-1")}>
            <Button type="button" className="h-8 min-w-0 rounded-lg px-2 text-[11px]" size="sm" onClick={onSave} disabled={isSaving} aria-label="Simpan modul" title="Simpan modul">
              <AapmIcon name={isSaving ? "refresh" : "checkRead"} className={cn("h-3.5 w-3.5", isSaving && "animate-spin")} />
              <span className="truncate">{isSaving ? "Menyimpan…" : "Simpan"}</span>
            </Button>
            {onPreview && (
              <Button type="button" variant="outline" size="sm" className="h-8 min-w-0 rounded-lg px-2 text-[11px]" onClick={onPreview} aria-label="Pratinjau learner" title="Pratinjau learner">
                <AapmIcon name="eye" className="h-3.5 w-3.5" />
                <span className="truncate">Lihat</span>
              </Button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-subtle px-2 py-1.5 text-[9px] leading-3 text-muted-foreground">
            <span className="font-semibold text-foreground">Shortcut</span>
            <span><kbd className="rounded border border-border bg-background px-1 py-0.5 font-semibold text-foreground">Ctrl/⌘ S</kbd> simpan</span>
            <span><kbd className="rounded border border-border bg-background px-1 py-0.5 font-semibold text-foreground">Alt 1–4</kbd> bagian</span>
          </div>
        </Surface>
      </aside>
    </>
  );
}
