import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import useReducedMotion from "@/lib/useReducedMotion";

export const appiAsset = (number) => `/assets/avatar/Asset%20${number}.svg`;

// APPI's moods (Redesign v2 rig). Each mood is one face, at most one decor
// badge and one body motion (academy.css §20). Pick the mood from what just
// happened — never cycle moods for decoration.
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
  // The burst badge keeps "surprised" apart from "concerned".
  surprised: { face: 11, decor: 16, label: "terkejut" },
  loading: { face: 5, decor: 24, label: "menyiapkan" },
};

// Calm faces with open eyes blink (face 2 laid over for 150 ms every ~5 s).
const BLINKING = new Set(["idle", "neutral", "happy", "talk", "curious", "data"]);
const BLINK_FACE = 2;
// Idle life: a wink, a glance up or a small hop every 7–11 s.
const GESTURING = new Set(["idle", "neutral", "happy", "talk", "curious", "data"]);
const GESTURES = [
  { name: "wink", face: 3, duration: 700 },
  { name: "peek", face: 5, duration: 1100 },
  { name: "hop", face: 7, duration: 760 },
];

// The only APPI sizes: 24–32 chat avatars · 44 quiz feedback · 64 calculator
// and lesson · 96 KPI and empty states · 132 home and results · 180 big
// celebrations. Badge and ground shadow drop out under 44.
export const APPI_SIZES = { xs: 24, sm: 32, md: 44, lg: 64, xl: 96, hero: 132, mega: 180 };
const ENTRANCES = new Set(["pop", "peek", "slide", "drop"]);

function sizeKey(size) {
  if (typeof size === "string" && APPI_SIZES[size]) return size;
  const pixels = Number(size) || APPI_SIZES.md;
  return Object.entries(APPI_SIZES).reduce((best, [key, value]) => (
    Math.abs(value - pixels) < Math.abs(APPI_SIZES[best] - pixels) ? key : best
  ), "md");
}

// Character-sized mascots report their visibility so the launcher can step
// back while a contextual APPI is on screen.
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
 * APPI, the Academy mascot, on the layered rig of the Redesign v2 canvas:
 * body motion by mood (pivoting at the feet), a CSS blink on calm faces, an
 * occasional gesture, a moving decor badge and a ground shadow, each APPI on
 * its own tempo. `enter` choreographs the arrival (pop · peek · slide ·
 * drop). Decorative unless `label` is given; reduced motion holds it still.
 *
 * @param {{ mood?: string, size?: string | number, enter?: string, enterDelay?: number, animated?: boolean, decor?: boolean, presence?: boolean, label?: string, className?: string, style?: Record<string, any> }} props
 */
export default function AppiMascot({
  mood = "idle",
  size = "md",
  enter = undefined,
  enterDelay = undefined,
  animated = true,
  decor = true,
  presence = undefined,
  label = undefined,
  className = undefined,
  style = undefined,
}) {
  const config = APPI_MOODS[mood] || APPI_MOODS.idle;
  const key = sizeKey(size);
  const pixels = APPI_SIZES[key];
  const rootRef = useRef(null);
  const reducedMotion = useReducedMotion();
  // Personal tempo 0.8–1.2× so two APPIs never move in step.
  const [rhythm] = useState(() => ({ tempo: (0.8 + Math.random() * 0.4).toFixed(2), delay: `-${(Math.random() * 2.6).toFixed(2)}s` }));
  useScreenPresence(rootRef, presence ?? pixels >= APPI_SIZES.lg);

  const [gesture, setGesture] = useState(null);
  const lively = animated && !reducedMotion && pixels >= APPI_SIZES.md && GESTURING.has(mood);
  useEffect(() => {
    if (!lively) { setGesture(null); return undefined; }
    let timer;
    let reset;
    const next = () => {
      timer = window.setTimeout(() => {
        const pick = GESTURES[Math.floor(Math.random() * GESTURES.length)];
        setGesture(pick);
        reset = window.setTimeout(() => { setGesture(null); next(); }, pick.duration);
      }, 7000 + Math.random() * 4000);
    };
    next();
    return () => { window.clearTimeout(timer); window.clearTimeout(reset); };
  }, [lively, mood]);

  const showDecor = decor && config.decor && pixels >= APPI_SIZES.md;

  return (
    <span
      ref={rootRef}
      className={cn("appi-rig", `appi-rig-${key}`, ENTRANCES.has(enter) && `appi-in-${enter}`, className)}
      data-mood={mood}
      data-still={animated ? undefined : "true"}
      data-gesture={gesture?.name}
      style={/** @type {React.CSSProperties} */ ({
        "--appi-tempo": rhythm.tempo,
        "--appi-delay": rhythm.delay,
        ...(enterDelay ? { "--appi-in": `${enterDelay}ms` } : null),
        ...style,
      })}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className="appi-body">
        <img key={mood} className="appi-face" src={appiAsset(config.face)} alt="" width={pixels} height={pixels} draggable={false} decoding="async" />
        {animated && BLINKING.has(mood) ? <img className="appi-blink" src={appiAsset(BLINK_FACE)} alt="" draggable={false} decoding="async" /> : null}
        {gesture ? <img className="appi-gesture" src={appiAsset(gesture.face)} alt="" draggable={false} decoding="async" /> : null}
      </span>
      {showDecor ? <img key={`decor-${mood}`} className="appi-decor" src={appiAsset(config.decor)} alt="" draggable={false} decoding="async" /> : null}
    </span>
  );
}

/**
 * APPI speaking: the rig beside a speech bubble that pops 280 ms after APPI
 * lands. Use it where APPI reads the learner's situation (home greeting, a
 * calculator verdict, the week's KPI). `live` announces bubble changes.
 *
 * @param {{ mood?: string, size?: string | number, enter?: string, title?: React.ReactNode, children?: React.ReactNode, actions?: React.ReactNode, hue?: string, live?: boolean, layout?: string, tail?: string, className?: string }} props
 */
export function AppiSays({ mood = "talk", size = "lg", enter = "pop", title = undefined, children = undefined, actions = undefined, hue = undefined, live = false, layout = "row", tail = "left", className = undefined }) {
  return (
    <div className={cn("appi-says", layout === "stack" && "stack items-center", className)} data-hue={hue}>
      <AppiMascot mood={mood} size={size} enter={enter} />
      <div className={cn("bubble appi-say stack gap-1", `tail-${layout === "stack" ? "down" : tail}`)} aria-live={live ? "polite" : undefined}>
        {title ? <p className="t-heading">{title}</p> : null}
        {children ? <div className="t-support">{children}</div> : null}
        {actions ? <div className="row wrap gap-2" style={{ marginTop: 4 }}>{actions}</div> : null}
      </div>
    </div>
  );
}
