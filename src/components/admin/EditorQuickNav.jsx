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
  Kbd,
} from "@/components/primitives";

function AddElementMenu({ items, onAddElement }) {
  if (!items.length || !onAddElement) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="soft" data-editor-add-menu aria-label="Tambah blok materi">
          <AapmIcon name="plus" />
          <span>Tambah blok</span>
          <AapmIcon name="chevronDown" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Tambah ke materi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.type} icon={item.icon || "add"} onSelect={() => onAddElement(item.type)} data-editor-add-item={item.type}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The editor's single command bar: where am I (section tabs), what can I add,
 * is my work saved, and the one Save action (also Ctrl/⌘ S).
 */
export default function EditorQuickNav({
  sections = [],
  activeSection = "",
  onNavigate = () => {},
  onPreview = null,
  onSave = () => {},
  isSaving = false,
  isDirty = false,
  elementItems = [],
  onAddElement = null,
}) {
  const sectionNavRef = useRef(null);

  // Keep the active section tab visible when the rail scrolls on phones.
  useEffect(() => {
    sectionNavRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSection]);

  const status = isSaving ? "saving" : isDirty ? "dirty" : "saved";

  return (
    <div className="aapm-editor-command-bar" aria-label="Navigasi dan aksi editor" data-editor-command-bar>
      <nav ref={sectionNavRef} className="aapm-editor-section-nav" aria-label="Bagian editor">
        {sections.map((section, index) => (
          <button
            key={section.id}
            type="button"
            className="aapm-editor-section-link"
            aria-current={section.id === activeSection ? "step" : undefined}
            title={section.detail ? `${section.label}: ${section.detail} (Alt+${index + 1})` : section.label}
            data-editor-section-link={section.id}
            onClick={() => onNavigate(section.id)}
          >
            {section.icon ? <AapmIcon name={section.icon} /> : null}
            {section.shortLabel || section.label}
          </button>
        ))}
      </nav>
      <div className="aapm-editor-command-actions">
        <span className="aapm-editor-save-status" data-status={status} role="status" aria-live="polite">
          <span className="aapm-chip__dot" aria-hidden="true" />
          <span className="aapm-editor-save-status__label">{status === "saving" ? "Menyimpan…" : status === "dirty" ? "Belum disimpan" : "Tersimpan"}</span>
        </span>
        <AddElementMenu items={elementItems} onAddElement={onAddElement} />
        {onPreview ? (
          <Button type="button" variant="ghost" size="sm" onClick={onPreview}>
            <AapmIcon name="eye" />Pratinjau
          </Button>
        ) : null}
        <Button type="button" size="sm" loading={isSaving} onClick={onSave} title="Simpan modul (Ctrl/⌘ S)">
          {!isSaving ? <AapmIcon name="check" /> : null}Simpan
          <Kbd className="aapm-editor-kbd">⌘S</Kbd>
        </Button>
      </div>
    </div>
  );
}
