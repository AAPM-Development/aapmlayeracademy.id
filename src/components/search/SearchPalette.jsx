import React, { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/design-system";
import { Ic } from "@/design-system/canvas";

/** Opens the palette on Ctrl/⌘ K while mounted. */
export function useCommandShortcut(onOpen) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}

/**
 * Command search dialog in the canvas vocabulary: a `.search` field over
 * grouped `.list` rows (tile · title · meta · chevron). Arrow keys move
 * between results; Enter opens one.
 *
 * groups: [{ label, items: [{ key, ic, hue, title, meta, onSelect }] }]
 */
export default function SearchPalette({ open, onOpenChange, title, description, placeholder, query, onQueryChange, groups = [], status }) {
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const visible = groups.filter((group) => group.items.length);

  // Through the open hook, not autoFocus, so the overlay can record what opened it.
  const focusInput = (event) => {
    event.preventDefault();
    inputRef.current?.focus();
  };

  const moveFocus = (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(listRef.current?.querySelectorAll("[data-result]") || []);
    if (!rows.length) return;
    event.preventDefault();
    const index = rows.indexOf(document.activeElement);
    const next = event.key === "ArrowDown" ? (index + 1) % rows.length : (index <= 0 ? rows.length - 1 : index - 1);
    rows[next].focus();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="palette" onKeyDown={moveFocus} onOpenAutoFocus={focusInput}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <label className="search search-lg">
          <Ic name="search" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} aria-label={title} ref={inputRef} />
          <span className="kbd" aria-hidden="true">Esc</span>
        </label>
        <div ref={listRef} className="palette-results">
          {status ? <p className="t-support t-muted palette-status" role="status">{status}</p> : null}
          {visible.map((group) => (
            <section key={group.label} className="stack gap-1" aria-label={group.label}>
              <span className="menu-label">{group.label}</span>
              <div className="list">
                {group.items.map((item) => (
                  <button key={item.key} type="button" className="li palette-row" data-result="" data-hue={item.hue} onClick={item.onSelect}>
                    <span className="tile tile-sm"><Ic name={item.ic} /></span>
                    <span className="stack grow" style={{ minWidth: 0 }}>
                      <span className="li-title t-clamp-1">{item.title}</span>
                      {item.meta ? <span className="li-meta t-clamp-1">{item.meta}</span> : null}
                    </span>
                    <Ic name="chev-right" size="sm" className="t-muted" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
