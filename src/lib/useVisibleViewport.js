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
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      delete root.dataset.keyboard;
      ["--aapm-visible-height", "--aapm-visible-top", "--aapm-visible-bottom"].forEach((property) => root.style.removeProperty(property));
    };
  }, []);
}
