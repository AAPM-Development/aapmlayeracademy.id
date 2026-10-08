import { useEffect, useRef } from "react";

const TICK_MS = 15000;
const IDLE_AFTER_MS = 120000;

/**
 * Active study time on one lesson. Time counts only while the tab is visible
 * and the learner touched, scrolled or typed in the last two minutes, so a
 * lesson left open does not inflate "Waktu belajar". When the learner leaves
 * the lesson (or switches module) the whole minutes go to `onFlush`.
 */
export default function useStudyTime(moduleNumber, onFlush) {
  const flushRef = useRef(onFlush);
  flushRef.current = onFlush;

  useEffect(() => {
    if (!moduleNumber) return undefined;
    let activeMs = 0;
    let lastActivity = Date.now();
    const markActive = () => { lastActivity = Date.now(); };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((name) => window.addEventListener(name, markActive, { passive: true }));
    document.addEventListener("scroll", markActive, { capture: true, passive: true });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastActivity < IDLE_AFTER_MS) activeMs += TICK_MS;
    }, TICK_MS);

    return () => {
      events.forEach((name) => window.removeEventListener(name, markActive));
      document.removeEventListener("scroll", markActive, { capture: true });
      window.clearInterval(timer);
      const minutes = Math.round(activeMs / 60000);
      if (minutes > 0) flushRef.current?.(moduleNumber, minutes);
    };
  }, [moduleNumber]);
}
