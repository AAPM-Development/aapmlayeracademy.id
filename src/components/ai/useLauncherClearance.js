import { useEffect } from "react";

const CONTROL = "button, a[href], input:not([type='hidden']), select, textarea, summary, [role='button'], [role='tab'], [role='link'], [contenteditable='true']";
const GAP = 12;
const MAX_LIFT = 140;

/**
 * The APPI launcher stays on screen everywhere but must never sit on a control.
 * When a button, link or field passes under it, the launcher slides up just
 * above that control (and back down once the spot is free). Where controls
 * stack up the right edge and no free spot is near, it tucks into the edge as
 * a small tab (data-peek) that hover, focus or a tap brings back. The lift is a
 * CSS custom property, so hover and press transforms keep working. The launcher
 * is read from the ref on every pass, because React may re-create the button.
 */
export default function useLauncherClearance(launcherRef, enabled) {
  useEffect(() => {
    if (!enabled || typeof document.elementsFromPoint !== "function") return undefined;
    let current = null;
    let lift = 0;
    let frame = 0;
    const blockerTop = (launcher, left, top, right, bottom) => {
      let highest = null;
      for (const fx of [0.15, 0.5, 0.85]) {
        for (const fy of [0.12, 0.5, 0.88]) {
          const x = left + (right - left) * fx;
          const y = top + (bottom - top) * fy;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
          for (const element of document.elementsFromPoint(x, y)) {
            if (launcher.contains(element)) continue;
            const control = element.closest(CONTROL);
            if (!control || launcher.contains(control)) continue;
            const rect = control.getBoundingClientRect();
            if (highest === null || rect.top < highest) highest = rect.top;
            break;
          }
        }
      }
      return highest;
    };
    const measure = () => {
      frame = 0;
      const launcher = launcherRef.current;
      if (!launcher || !launcher.isConnected) return;
      if (launcher !== current) {
        // A new button starts unlifted.
        current = launcher;
        lift = Number.parseFloat(launcher.style.getPropertyValue("--launcher-lift")) || 0;
      }
      // Where the launcher rests, from its fixed offsets: lift, peek and
      // hover transforms do not move this.
      const style = window.getComputedStyle(launcher);
      const width = launcher.offsetWidth;
      const height = launcher.offsetHeight;
      const right = window.innerWidth - (Number.parseFloat(style.right) || 0);
      const bottom = window.innerHeight - (Number.parseFloat(style.bottom) || 0);
      const base = { left: right - width, right, top: bottom - height, bottom };
      const maxLift = Math.min(MAX_LIFT, window.innerHeight * 0.3);
      let next = 0;
      let clear = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const top = blockerTop(launcher, base.left, base.top - next, base.right, base.bottom - next);
        if (top === null) {
          clear = true;
          break;
        }
        next = base.bottom - top + GAP;
        if (next > maxLift) break;
      }
      const peek = !clear;
      if (peek) next = 0;
      if ((launcher.dataset.peek === "true") !== peek) {
        if (peek) launcher.dataset.peek = "true";
        else delete launcher.dataset.peek;
      }
      if (Math.abs(next - lift) < 2) return;
      lift = next;
      launcher.style.setProperty("--launcher-lift", `${lift}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    schedule();
    // Content changes (route, data, opened sections) can bring a control under it.
    const timer = window.setInterval(schedule, 700);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      current?.style.removeProperty("--launcher-lift");
      if (current) delete current.dataset.peek;
    };
  }, [enabled, launcherRef]);
}
