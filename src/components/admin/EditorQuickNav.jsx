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
        "group flex min-w-max items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-tint-orange text-tint-orange-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[9px] font-bold leading-none",
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
          className="h-8 shrink-0 rounded-lg bg-brand-orange px-2.5 text-[11px] text-white hover:bg-brand-orange/90"
          aria-label="Tambah elemen materi"
          title="Tambah elemen materi"
          data-editor-add-menu
        >
          <AapmIcon name="add" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tambah</span>
          <AapmIcon name="chevronDown" className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Tambah ke materi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.type}
            onSelect={() => onAddElement(item.type)}
            className="items-start py-2"
            data-editor-add-item={item.type}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-tint-orange text-brand-orange">
              <AapmIcon name={item.icon || "add"} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold">{item.label}</span>
              {item.detail && <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{item.detail}</span>}
            </span>
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
      className="sticky top-2 z-40 flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-sm"
      aria-label="Navigasi dan aksi editor"
      data-editor-command-bar
    >
      <div className="flex min-w-0 items-center gap-2 px-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange" aria-hidden="true">
          <AapmIcon name="sidebar" className="h-3.5 w-3.5" />
        </span>
        <div className="hidden min-w-0 sm:block">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Editor modul</p>
          <p className="max-w-[8rem] truncate text-[11px] font-semibold text-foreground">{activeSectionMeta?.label || "Navigasi"}</p>
        </div>
      </div>

      <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

      <nav className="aapm-scrollbar flex min-w-0 flex-[1_1_12rem] gap-0.5 overflow-x-auto" aria-label="Bagian editor">
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

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1.5 lg:flex" aria-label={`Progres bagian ${activeIndex + 1} dari ${sections.length}`}>
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-orange transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground">{sections.length ? `${activeIndex + 1}/${sections.length}` : "0/0"}</span>
        </div>
        <Badge variant="soft" className={cn("hidden h-6 items-center px-2 text-[10px] sm:inline-flex", isDirty ? "bg-tint-orange text-tint-orange-foreground" : "bg-tint-green text-brand-green")}>
          {isDirty ? "Draft" : "Siap"}
        </Badge>
        <AddElementMenu items={elementItems} onAddElement={onAddElement} />
        {onPreview && (
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 rounded-lg px-2 text-[11px]" onClick={onPreview} aria-label="Pratinjau learner" title="Pratinjau learner">
            <AapmIcon name="eye" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lihat</span>
          </Button>
        )}
        <Button type="button" size="sm" className="h-8 shrink-0 rounded-lg px-2 text-[11px]" onClick={onSave} disabled={isSaving} aria-label="Simpan modul" title="Simpan modul">
          <AapmIcon name={isSaving ? "refresh" : "checkRead"} className={cn("h-3.5 w-3.5", isSaving && "animate-spin")} />
          <span className="hidden sm:inline">{isSaving ? "Menyimpan…" : "Simpan"}</span>
        </Button>
      </div>

      <span className="hidden text-[9px] text-muted-foreground 2xl:inline">
        <kbd className="rounded border border-border bg-background px-1 py-0.5 font-semibold text-foreground">Ctrl/⌘ S</kbd>
      </span>
    </div>
  );
}
