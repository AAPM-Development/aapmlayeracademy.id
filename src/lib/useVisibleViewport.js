import { useEffect } from "react";

/** Follow the visible screen when a mobile keyboard resizes only VisualViewport. */
export default function useVisibleViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const root = document.documentElement;
    let frame = 0;
    let fullHeight = window.innerHeight;
    let width = window.innerWidth;
    const update = () => {
      frame = 0;
      const field = document.activeElement;
      const editing = field?.matches('input, textarea, [contenteditable="true"]');
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        fullHeight = window.innerHeight;
      }
      if (!editing && root.dataset.keyboard !== "open") fullHeight = window.innerHeight;
      const keyboard = Boolean(editing && Math.abs(viewport.scale - 1) < 0.05 && Math.max(fullHeight, window.innerHeight) - viewport.height > 120);
      root.style.setProperty("--aapm-visible-height", `${viewport.height}px`);
      root.style.setProperty("--aapm-visible-top", `${viewport.offsetTop}px`);
      root.style.setProperty("--aapm-visible-bottom", `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
      root.dataset.keyboard = keyboard ? "open" : "closed";
      // A keyboard can shrink the shell after the browser has focused the
      // field. Keep that field above docked actions by scrolling its panel only.
      const panel = keyboard && window.innerWidth <= 1023 ? field?.closest?.('.aapm-app__main') : null;
      if (panel && panel.scrollHeight > panel.clientHeight) {
        const bounds = panel.getBoundingClientRect();
        const rect = field.getBoundingClientRect();
        const top = Math.max(bounds.top, viewport.offsetTop);
        let bottom = Math.min(bounds.bottom, viewport.offsetTop + viewport.height);
        const actions = document.querySelector('.aapm-editor-actionbar, .aapm-curriculum-actionbar');
        if (actions) {
          const actionBounds = actions.getBoundingClientRect();
          if (actionBounds.bottom > top && actionBounds.top < bottom) bottom = Math.max(top, actionBounds.top);
        }
        const launcher = document.querySelector('.aapm-ai-launcher');
        if (launcher) {
          const launcherBounds = launcher.getBoundingClientRect();
          if (launcherBounds.width > 0 && launcherBounds.right > rect.left && launcherBounds.left < rect.right && launcherBounds.bottom > top && launcherBounds.top < bottom) {
            bottom = Math.max(top, launcherBounds.top);
          }
        }
        const delta = rect.height > bottom - top ? rect.top - top
          : rect.bottom > bottom ? rect.bottom - bottom
            : rect.top < top ? rect.top - top : 0;
        if (Math.abs(delta) > 1) panel.scrollBy({ top: delta, behavior: 'instant' });
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    // Footer measurement can move APPI one frame after viewport resizing.
    document.addEventListener("aapm:footer-resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      document.removeEventListener("aapm:footer-resize", schedule);
      delete root.dataset.keyboard;
      ["--aapm-visible-height", "--aapm-visible-top", "--aapm-visible-bottom"].forEach((property) => root.style.removeProperty(property));
    };
  }, []);
}
