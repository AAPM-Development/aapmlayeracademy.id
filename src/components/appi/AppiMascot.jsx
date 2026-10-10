import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import useReducedMotion from "@/lib/useReducedMotion";

const asset = (number) => `/assets/avatar/Asset%20${number}.svg`;

// APPI's moods. Each one is one face plus at most one decor badge from the
// mascot sheet (faces 1–12, decor 13–24). Moods carry meaning, so pick the one
// that matches what just happened rather than cycling for decoration.
export const APPI_MOODS = {
  idle: { face: 1, decor: null, label: "siap membantu" },
  neutral: { face: 12, decor: null, label: "memperhatikan" },
  happy: { face: 8, decor: 13, label: "senang" },
  cheer: { face: 9, decor: 18, label: "merayakan" },
  proud: { face: 7, decor: 15, label: "bangga" },
  wink: { face: 3, decor: 22, label: "menyemangati" },
  talk: { face: 4, decor: 14, label: "menjelaskan" },
  think: { face: 5, decor: 17, label: "berpikir" },
  idea: { face: 7, decor: 20, label: "punya ide" },
  curious: { face: 6, decor: 17, label: "penasaran" },
  data: { face: 4, decor: 23, label: "membaca data" },
  concerned: { face: 10, decor: 21, label: "perlu perhatian" },
  surprised: { face: 11, decor: 21, label: "terkejut" },
  loading: { face: 5, decor: 24, label: "menyiapkan" },
};

// Moods that blink: calm faces with open eyes. Expressive faces stay as drawn.
const BLINKING = new Set(["idle", "neutral", "happy", "talk", "curious", "data"]);
const BLINK_FACE = 2;
const GESTURING = new Set(["idle", "neutral", "happy", "talk", "wink", "curious", "data"]);
const GESTURES = [
  { name: "wink", face: 3, duration: 700 },
  { name: "peek", face: 5, duration: 1100 },
  { name: "hop", face: 7, duration: 760 },
  { name: "nod", face: 4, duration: 900 },
  { name: "turn", face: 1, duration: 1600 },
  { name: "turn", face: 6, duration: 1400 },
  { name: "swap", face: 1, duration: 0 },
];

const SIZES = { xs: 24, sm: 32, md: 44, lg: 64, xl: 96, hero: 132 };

// Character-sized mascots report their visibility for contextual presentation.
// The launcher remains available independently of this state.
let visibleCharacters = 0;
function setOnScreen(delta) {
  visibleCharacters = Math.max(0, visibleCharacters + delta);
  if (visibleCharacters > 0) document.documentElement.dataset.appiOnScreen = "true";
  else delete document.documentElement.dataset.appiOnScreen;
}

function useScreenPresence(ref, enabled) {
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node || typeof IntersectionObserver === "undefined") return undefined;
    let counted = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !counted) { counted = true; setOnScreen(1); }
      else if (!entry.isIntersecting && counted) { counted = false; setOnScreen(-1); }
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (counted) setOnScreen(-1);
    };
  }, [ref, enabled]);
}

/**
 * APPI, the Academy mascot: a rooster head with one mood at a time. It bobs
 * gently and blinks when `animated`, pops into a new mood, and carries an
 * optional decor badge (sparkle, idea, check…) that explains the mood.
 * Decorative unless `label` is given; under reduced motion it holds still.
 * Character sizes (64px and up) report their presence;
 * pass `presence={false}` for the launcher itself.
 */
/**
 * @param {{ mood?: string, size?: string | number, animated?: boolean, decor?: boolean, presence?: boolean, label?: string, className?: string, style?: Record<string, any> }} props
 */
export default function AppiMascot({
  mood = "idle",
  size = "md",
  animated = true,
  decor = true,
  presence = undefined,
  label = undefined,
  className = undefined,
  style = undefined,
}) {
  const config = APPI_MOODS[mood] || APPI_MOODS.idle;
  const pixels = typeof size === "number" ? size : SIZES[size] || SIZES.md;
  const [blinking, setBlinking] = useState(false);
  const timers = useRef([]);
  const rootRef = useRef(null);
  // Each APPI keeps its own rhythm, so two on one screen never move in step.
  const [rhythm] = useState(() => ({ tempo: (0.82 + Math.random() * 0.4).toFixed(2), delay: `-${(Math.random() * 2.6).toFixed(2)}s` }));
  const canBlink = animated && BLINKING.has(mood);
  useScreenPresence(rootRef, presence ?? pixels >= SIZES.lg);

  // Idle life: every few seconds a character-sized APPI does one small thing
  // (a wink, a glance up, a hop) and settles back, so it reads as alive
  // rather than a sticker. Never under reduced motion.
  const [gesture, setGesture] = useState(null);
  const [facing, setFacing] = useState("right");
  const reducedMotion = useReducedMotion();
  const lively = animated && pixels >= SIZES.sm && GESTURING.has(mood);
  useEffect(() => {
    if (!lively || reducedMotion) { setGesture(null); return undefined; }
    let timer;
    let reset;
    const next = () => {
      timer = window.setTimeout(() => {
        const pick = GESTURES[Math.floor(Math.random() * GESTURES.length)];
        // A turn looks the other way for a moment; a swap stays turned until
        // the next one, so APPI does not always face the same side.
        if (pick.name === "swap") { setFacing((side) => (side === "right" ? "left" : "right")); next(); return; }
        if (pick.name === "turn") setFacing((side) => (side === "right" ? "left" : "right"));
        setGesture(pick);
        reset = window.setTimeout(() => {
          if (pick.name === "turn") setFacing((side) => (side === "right" ? "left" : "right"));
          setGesture(null);
          next();
        }, pick.duration);
      }, 3200 + Math.random() * 4200);
    };
    next();
    return () => { window.clearTimeout(timer); window.clearTimeout(reset); setGesture(null); setFacing("right"); };
  }, [lively, mood, reducedMotion]);

  useEffect(() => {
    if (!canBlink || reducedMotion) return undefined;
    const list = timers.current;
    const schedule = () => {
      const wait = 2600 + Math.random() * 3600;
      const timer = window.setTimeout(() => {
        setBlinking(true);
        const reset = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 150);
        list.splice(0, list.length, reset);
      }, wait);
      list.splice(0, list.length, timer);
    };
    schedule();
    return () => {
      list.forEach((timer) => window.clearTimeout(timer));
      list.length = 0;
      setBlinking(false);
    };
  }, [canBlink, reducedMotion]);

  return (
    <span
      ref={rootRef}
      className={cn("aapm-appi", className)}
      data-mood={mood}
      data-animated={animated ? "true" : undefined}
      data-gesture={gesture?.name}
      data-facing={facing === "left" ? "left" : undefined}
      data-size={typeof size === "string" ? size : undefined}
      style={/** @type {React.CSSProperties} */ ({ "--appi-size": `${pixels}px`, "--appi-tempo": rhythm.tempo, "--appi-delay": rhythm.delay, ...style })}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {animated && pixels >= SIZES.md ? <span className="aapm-appi__shadow" /> : null}
      <span className="aapm-appi__head" data-blink={blinking && !gesture ? "true" : undefined}>
        <span className="aapm-appi__turn">
        <img key={mood} className="aapm-appi__face" src={asset(config.face)} alt="" width={pixels} height={pixels} draggable={false} decoding="async" />
        {gesture ? <img className="aapm-appi__gesture" src={asset(gesture.face)} alt="" width={pixels} height={pixels} draggable={false} decoding="async" /> : null}
        {canBlink ? (
          <img className="aapm-appi__blink" src={asset(BLINK_FACE)} alt="" width={pixels} height={pixels} draggable={false} decoding="async" />
        ) : null}
        </span>
      </span>
      {decor && config.decor ? (
        <img key={`decor-${mood}`} className="aapm-appi__decor" src={asset(config.decor)} alt="" draggable={false} decoding="async" />
      ) : null}
    </span>
  );
}

/**
 * APPI speaking: the mascot beside a speech bubble. Use it where APPI reads
 * the learner's situation (greeting, a calculator verdict, the week's KPI).
 * `live` announces bubble changes politely.
 */
/** @param {{ mood?: string, size?: string | number, title?: React.ReactNode, children?: React.ReactNode, actions?: React.ReactNode, hue?: string, live?: boolean, layout?: string, className?: string }} props */
export function AppiSays({ mood = "talk", size = "lg", title = undefined, children = undefined, actions = undefined, hue = undefined, live = false, layout = "row", className = undefined }) {
  return (
    <div className={cn("aapm-appi-says", className)} data-hue={hue} data-layout={layout}>
      <AppiMascot mood={mood} size={size} />
      <div className="aapm-appi-says__bubble" aria-live={live ? "polite" : undefined}>
        {title ? <p className="aapm-appi-says__title">{title}</p> : null}
        {children ? <div className="aapm-appi-says__text">{children}</div> : null}
        {actions ? <div className="aapm-appi-says__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
