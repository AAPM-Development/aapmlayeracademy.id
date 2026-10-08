import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Radix layers (menus, confirm dialogs) render outside the surface and own
// Escape and Tab while they are open, so the surface must stand aside.
function hasNestedLayer(surface) {
  return [
    ...document.querySelectorAll(
      '[data-state="open"][role="menu"], [data-state="open"][role="listbox"], [data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]',
    ),
  ].some((layer) => layer !== surface && !surface.contains(layer));
}

/**
 * Focus behaviour for an in-page dialog or sheet: focus moves in when it opens,
 * Tab cycles inside it, Escape closes it, and focus returns to the control that
 * opened it. Returns the ref for the surface element.
 */
export default function useModalFocus({ open, onClose }) {
  const surfaceRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const focusSurface = () => {
      const surface = surfaceRef.current;
      if (!surface) return false;
      (surface.querySelector(FOCUSABLE) || surface).focus({ preventScroll: true });
      return surface.contains(document.activeElement);
    };
    // Focus lands at once when the surface is already rendered. The timer is a fallback
    // for surfaces whose visibility and transform settle in the same commit.
    let timer = 0;
    if (!focusSurface()) timer = window.setTimeout(focusSurface, 0);

    const handleKeyDown = (event) => {
      const surface = surfaceRef.current;
      if (!surface || event.defaultPrevented || hasNestedLayer(surface)) return;

      if (event.key === "Escape") {
        // Stop here so an enclosing surface (the floating panel) keeps its own state.
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const items = [...surface.querySelectorAll(FOCUSABLE)];
      if (!items.length) {
        event.preventDefault();
        surface.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = surface.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      if (opener?.focus && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return surfaceRef;
}
