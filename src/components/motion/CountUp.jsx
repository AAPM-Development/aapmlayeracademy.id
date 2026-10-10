import React, { useEffect, useRef, useState } from "react";
import useReducedMotion from "@/lib/useReducedMotion";

const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * Animated number for scores and metrics: counts from the previous value to
 * the new one, so a changed reading is noticed. Screen readers get the final
 * text once; the counting digits are hidden from them. Non-finite values
 * render `fallback` without animating.
 */
/** @param {{ value: any, format?: (value: number) => string, duration?: number, fallback?: string, className?: string }} props */
export default function CountUp({ value, format = (number) => String(Math.round(number)), duration = 700, fallback = "—", className = undefined }) {
  const reducedMotion = useReducedMotion();
  const target = Number(value);
  const finite = Number.isFinite(target);
  const [shown, setShown] = useState(finite && !reducedMotion ? 0 : target);
  const fromRef = useRef(finite && !reducedMotion ? 0 : target);
  const frame = useRef(0);

  useEffect(() => {
    if (!finite) return undefined;
    const from = Number.isFinite(fromRef.current) ? fromRef.current : 0;
    if (reducedMotion || from === target) {
      fromRef.current = target;
      setShown(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * easeOut(progress);
      fromRef.current = next;
      setShown(next);
      if (progress < 1) frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame.current);
  }, [target, finite, duration, reducedMotion]);

  if (!finite) return <span className={className}>{fallback}</span>;
  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="aapm-visually-hidden">{format(target)}</span>
    </span>
  );
}
