// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Badge,
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
      data-editor-section-link={section.id}
      className={cn(
        "aapm-editor-section-link group flex min-w-max items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-tint-orange text-tint-orange-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] font-mono text-[9px] font-bold leading-none",
          active
            ? "bg-brand-orange text-white"
            : "bg-surface-subtle text-muted-foreground group-hover:text-foreground",
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
          className="h-9 shrink-0 bg-brand-orange px-2.5 text-xs text-white hover:bg-brand-orange/90"
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
  isDirty = false,
  isSaving = false,
  elementItems = [],
  onAddElement = null,
}) {
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection));
  const activeSectionMeta = sections[activeIndex];
  const progress = sections.length ? ((activeIndex + 1) / sections.length) * 100 : 0;

  return (
    <div
      className="aapm-editor-command-bar md:sticky md:top-2 z-40 flex min-w-0 flex-wrap items-center gap-2"
      aria-label="Navigasi dan aksi editor"
      data-editor-command-bar
    >
      <nav className="aapm-scrollbar flex min-w-0 flex-[1_1_18rem] items-center gap-1 overflow-x-auto" aria-label={`Bagian editor: ${activeSectionMeta?.label || "Navigasi"}`}>
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

      <div className="aapm-editor-command-actions flex shrink-0 items-center gap-1.5 sm:border-l sm:border-border sm:pl-3">
        <div className="hidden items-center gap-1.5 lg:flex" aria-label={`Progres bagian ${activeIndex + 1} dari ${sections.length}`}>
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-orange transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground">{sections.length ? `${activeIndex + 1}/${sections.length}` : "0/0"}</span>
        </div>
        <Badge variant="soft" className={cn("hidden h-6 items-center px-2 text-[10px] sm:inline-flex", isDirty ? "bg-tint-orange text-tint-orange-foreground" : "bg-tint-green text-brand-green")}>
          {isDirty ? "Draft lokal" : "Tersimpan"}
        </Badge>
        <AddElementMenu items={elementItems} onAddElement={onAddElement} />
        {onPreview && (
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-2.5 text-xs" onClick={onPreview} aria-label="Pratinjau learner" title="Pratinjau learner">
            <AapmIcon name="eye" className="h-3.5 w-3.5" />
            <span className="inline">Lihat</span>
          </Button>
        )}
        <Button type="button" size="sm" className="h-9 shrink-0 px-2.5 text-xs" onClick={onSave} disabled={isSaving} aria-label="Simpan modul" title="Simpan modul">
          <AapmIcon name={isSaving ? "refresh" : "checkRead"} className={cn("h-3.5 w-3.5", isSaving && "animate-spin")} />
          <span className="inline">{isSaving ? "Menyimpan…" : "Simpan"}</span>
        </Button>
      </div>

      <span className="hidden text-[9px] text-muted-foreground 2xl:inline">
        <kbd className="rounded border border-border bg-background px-1 py-0.5 font-semibold text-foreground">Ctrl/⌘ S</kbd>
      </span>
    </div>
  );
}
