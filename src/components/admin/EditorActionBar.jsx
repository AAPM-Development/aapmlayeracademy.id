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

export function AddElementMenu({ groups = [], onAddElement }) {
  if (!groups.length || !onAddElement) return null;
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
        {groups.map((group, groupIndex) => (
          <React.Fragment key={group.label}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
            {group.items.map((item) => (
              <DropdownMenuItem key={item.type} icon={item.icon || "add"} onSelect={() => onAddElement(item.type)} data-editor-add-item={item.type}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
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
  elementGroups = [],
  onAddElement = null,
  onSave = () => {},
  onRetry = () => {},
  onOpenOutline = () => {},
  onOpenInspector = () => {},
  isSaving = false,
  isDirty = false,
  saveError = "",
  savedAt = null,
  disabled = false,
}) {
  const status = isSaving ? "saving" : saveError ? "error" : isDirty ? "dirty" : "saved";
  const label = {
    saving: "Menyimpan…",
    error: "Gagal disimpan",
    dirty: "Belum disimpan",
    saved: savedAt ? `Tersimpan ${savedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Tersimpan",
  }[status];

  return (
    <div className="aapm-editor-actionbar" data-editor-actionbar>
      <span className="aapm-editor-save-status" data-status={status} role="status" aria-live="polite">
        <span className="aapm-chip__dot" aria-hidden="true" />
        <span className="aapm-editor-save-status__label">{label}</span>
        {status === "error" ? <span className="aapm-editor-save-status__detail">{saveError}</span> : null}
      </span>
      {status === "error" ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>Coba lagi</Button>
      ) : null}
      <div className="aapm-editor-actionbar__actions">
        {/* Drawer triggers: Susun below 1200px; Blok and Modul below 640px, where the inspector is a sheet. */}
        <Button type="button" size="sm" variant="ghost" data-drawer="outline" onClick={onOpenOutline}><AapmIcon name="lesson" />Susun</Button>
        <Button type="button" size="sm" variant="ghost" data-drawer="inspector" onClick={() => onOpenInspector("block")}><AapmIcon name="widget" />Blok</Button>
        <Button type="button" size="sm" variant="ghost" data-drawer="inspector" onClick={() => onOpenInspector("module")}><AapmIcon name="settings" />Modul</Button>
        <AddElementMenu groups={elementGroups} onAddElement={onAddElement} />
        <Button type="button" size="sm" loading={isSaving} disabled={disabled} onClick={onSave} title="Simpan draf (Ctrl/⌘ S)">
          {!isSaving ? <AapmIcon name="check" /> : null}Simpan draf
          <Kbd className="aapm-editor-kbd">⌘S</Kbd>
        </Button>
      </div>
    </div>
  );
}
