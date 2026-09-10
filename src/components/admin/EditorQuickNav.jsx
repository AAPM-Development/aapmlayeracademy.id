// @ts-nocheck
import React, { useEffect, useRef } from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitives";
import { cn } from "@/lib/utils";

function SectionButton({ section, active, onNavigate, index = 0 }) {
  const label = section.shortLabel || section.label;
  const description = section.detail ? `${section.label}: ${section.detail}` : section.label;

  return (
    <button
      type="button"
      onClick={() => onNavigate(section.id)}
      aria-current={active ? "step" : undefined}
      aria-label={description}
      title={description}
      data-active={active ? "true" : "false"}
      data-editor-section-link={section.id}
      className={cn(
        "aapm-editor-section-link group flex min-w-max items-center gap-2 px-2 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-bold leading-none transition-colors",
          active
            ? "border-brand-orange/60 bg-tint-orange/50 text-brand-orange"
            : "border-border/70 bg-transparent text-muted-foreground group-hover:border-border group-hover:text-foreground",
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function AddElementMenu({ items, onAddElement }) {
  if (!items.length || !onAddElement) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 border-brand-orange/40 px-2.5 text-xs text-brand-orange hover:border-brand-orange/70 hover:bg-tint-orange/40 hover:text-brand-orange"
          aria-label="Tambah elemen materi"
          title="Tambah elemen materi"
          data-editor-add-menu
        >
          <AapmIcon name="add" className="h-3.5 w-3.5" />
          <span className="inline">Tambah</span>
          <AapmIcon name="chevronDown" className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">Tambah elemen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.type}
            onSelect={() => onAddElement(item.type)}
            className="items-center py-1.5"
            data-editor-add-item={item.type}
          >
            <span className="aapm-token-icon mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-tint-orange text-brand-orange">
              <AapmIcon name={item.icon || "add"} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 text-xs font-semibold">{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function EditorQuickNav({
  sections = [],
  activeSection = "",
  onNavigate = () => {},
  onPreview = null,
  onSave = () => {},
  isSaving = false,
  elementItems = [],
  onAddElement = null,
}) {
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection));
  const activeSectionMeta = sections[activeIndex];
  const sectionNavRef = useRef(null);

  // The section rail intentionally scrolls horizontally on narrow screens.
  // Keep the selected location in view when moving between editor steps so
  // the compact mobile shell never leaves the active step hidden off-canvas.
  useEffect(() => {
    const activeLink = sectionNavRef.current?.querySelector('[data-active="true"]');
    activeLink?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSection]);

  return (
    <div
      className="aapm-editor-command-bar md:sticky md:top-2 z-40 min-w-0"
      aria-label="Navigasi dan aksi editor"
      data-editor-command-bar
    >
      <div className="aapm-editor-command-top flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="aapm-editor-current-location flex min-w-0 items-center gap-2" data-editor-current-location>
          <span className="aapm-editor-current-index font-mono text-[10px] font-semibold text-brand-orange">{String(activeIndex + 1).padStart(2, "0")}</span>
          <span className="min-w-0">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sedang mengedit</span>
            <span className="block truncate text-xs font-semibold text-foreground">{activeSectionMeta?.shortLabel || "Bagian editor"}</span>
          </span>
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{sections.length ? `${activeIndex + 1}/${sections.length}` : "0/0"}</span>
        </div>

        <nav ref={sectionNavRef} className="aapm-editor-section-nav aapm-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label={`Bagian editor: ${activeSectionMeta?.label || "Navigasi"}`}>
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

        <div className="aapm-editor-command-actions flex shrink-0 items-center gap-1.5">
          <AddElementMenu items={elementItems} onAddElement={onAddElement} />
          {onPreview && (
            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={onPreview} aria-label="Pratinjau learner" title="Pratinjau learner">
              <AapmIcon name="eye" className="h-3.5 w-3.5" />
              <span className="inline">Lihat</span>
            </Button>
          )}
          <Button type="button" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={onSave} disabled={isSaving} aria-label="Simpan modul" title="Simpan modul">
            <AapmIcon name={isSaving ? "refresh" : "checkRead"} className={cn("h-3.5 w-3.5", isSaving && "animate-spin")} />
            <span className="inline">{isSaving ? "Menyimpan…" : "Simpan"}</span>
          </Button>
        </div>

        <span className="hidden text-[9px] text-muted-foreground 2xl:inline">
          <kbd className="rounded border border-border/70 bg-transparent px-1 py-0.5 font-semibold text-foreground">Ctrl/⌘ S</kbd>
        </span>
      </div>
    </div>
  );
}
