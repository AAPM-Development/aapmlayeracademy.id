import React from "react";
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

export function AddElementMenu({ items, onAddElement }) {
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
 * The editor's one save surface: where the work stands, what can be added, and
 * the single Simpan action (also Ctrl/⌘ S). It stays at the bottom of the canvas.
 */
export default function EditorActionBar({
  elementItems = [],
  onAddElement = null,
  onSave = () => {},
  isSaving = false,
  isDirty = false,
}) {
  const status = isSaving ? "saving" : isDirty ? "dirty" : "saved";

  return (
    <div className="aapm-editor-actionbar" data-editor-actionbar>
      <span className="aapm-editor-save-status" data-status={status} role="status" aria-live="polite">
        <span className="aapm-chip__dot" aria-hidden="true" />
        <span className="aapm-editor-save-status__label">{status === "saving" ? "Menyimpan…" : status === "dirty" ? "Belum disimpan" : "Tersimpan"}</span>
      </span>
      <div className="aapm-editor-actionbar__actions">
        <AddElementMenu items={elementItems} onAddElement={onAddElement} />
        <Button type="button" size="sm" loading={isSaving} onClick={onSave} title="Simpan modul (Ctrl/⌘ S)">
          {!isSaving ? <AapmIcon name="check" /> : null}Simpan
          <Kbd className="aapm-editor-kbd">⌘S</Kbd>
        </Button>
      </div>
    </div>
  );
}
