import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { curriculumPrimaryAction } from "@/lib/curriculumEditorState";
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
/** @param {{ elementGroups?: any[], onAddElement?: ((type: string) => void) | null, onSave?: () => void, onRetry?: () => void, onOpenOutline?: () => void, onOpenInspector?: (section: string) => void, isSaving?: boolean, isDirty?: boolean, isNew?: boolean, saveError?: string, savedAt?: Date | null, disabled?: boolean }} props */
export default function EditorActionBar({
  elementGroups = [],
  onAddElement = null,
  onSave = () => {},
  onRetry = () => {},
  onOpenOutline = () => {},
  onOpenInspector = () => {},
  isSaving = false,
  isDirty = false,
  isNew = false,
  saveError = "",
  savedAt = null,
  disabled = false,
}) {
  const barRef = React.useRef(null);
  React.useEffect(() => {
    const bar = barRef.current;
    const content = bar?.closest('.aapm-editor-content');
    if (!bar || !content) return undefined;
    const root = document.documentElement;
    const update = () => {
      const rect = bar.getBoundingClientRect();
      const height = `${rect.height}px`;
      content.style.setProperty('--aapm-editor-footer-height', height);
      root.style.setProperty('--aapm-editor-footer-height', height);
      root.style.setProperty('--aapm-editor-footer-offset', `${rect.bottom > 0 && rect.top < window.innerHeight ? Math.max(0, window.innerHeight - rect.top) : 0}px`);
      root.dataset.editorFooter = 'true';
    };
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
      content.style.removeProperty('--aapm-editor-footer-height');
      root.style.removeProperty('--aapm-editor-footer-height');
      root.style.removeProperty('--aapm-editor-footer-offset');
      delete root.dataset.editorFooter;
    };
  }, []);
  const status = isSaving ? "saving" : saveError ? "error" : isDirty ? "dirty" : "saved";
  const primaryAction = curriculumPrimaryAction({ dirty: isDirty, isNew });
  const label = {
    saving: "Menyimpan…",
    error: "Gagal disimpan",
    dirty: "Belum disimpan",
    saved: savedAt ? `Tersimpan ${savedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Tersimpan",
  }[status];

  return (
    <div ref={barRef} className="aapm-editor-actionbar" data-editor-actionbar>
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
        <Button type="button" size="sm" variant={primaryAction === "save" ? "primary" : "secondary"} data-editor-save loading={isSaving} disabled={disabled} onClick={onSave} title="Simpan draf (Ctrl/⌘ S)">
          {!isSaving ? <AapmIcon name="check" /> : null}Simpan draf
          <Kbd className="aapm-editor-kbd">⌘S</Kbd>
        </Button>
      </div>
    </div>
  );
}
