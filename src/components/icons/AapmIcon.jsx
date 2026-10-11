import React from "react";
import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  aapmCustomIconData,
  aapmIconSources,
  legacyIconAliases,
  solarIconData,
} from "@/design-system/icons/iconData";

// Redesign v2 draws icons from the canvas stroke set (academy.css §5: mask
// icons that follow currentColor). Semantic names map onto that set; Solar
// remains only for glyphs the canvas does not draw (editor alignment, a few
// farm metrics) and for authored raw icon strings.

export { aapmIconSources };
export const aapmIconNames = Object.freeze(Object.keys(aapmIconSources));

/** Semantic AAPM icon name → canvas icon (`.ic-<name>`). */
export const canvasIconNames = Object.freeze({
  dashboard: "home", course: "book", book: "book", modules: "layers", lesson: "book",
  assessment: "exam", quiz: "exam", exam: "exam", certificate: "cert", award: "award",
  graduation: "grad", users: "users", user: "user", admin: "shield", analytics: "chart",
  kpi: "chart", chart: "chart", graph: "chart", calculator: "calc", ai: "sparkle",
  communication: "message", chat: "message", media: "image", image: "image", imageAdd: "image",
  video: "video", presentation: "slides", type: "text", settings: "sliders", slider: "sliders",
  workspace: "server", history: "history", target: "target", insight: "bulb", practice: "egg",
  roadmap: "route", layers: "layers", package: "box", widget: "grid", finance: "wallet",
  money: "wallet", weight: "scale", waterRate: "drop", hvac: "wind", mortality: "heart",
  trendUp: "trend-up", trendDown: "trend-down", clock: "clock", timer: "clock", hourglass: "clock",
  pending: "clock", calendar: "calendar", lock: "lock", mail: "mail", shield: "shield",
  global: "globe", flag: "flag", streak: "flame", star: "star", bell: "bell", filter: "filter",
  copy: "copy", send: "send", linkSemantic: "link", link: "link", editorLink: "link",
  camera: "camera", list: "list", table: "table", map: "map", smartphone: "phone",
  check: "check", glyphCheck: "check", success: "check-circle", checkRead: "check-circle",
  info: "info", alert: "alert", warning: "alert", alertCircle: "alert", danger: "alert",
  closeCircle: "x-circle", close: "x", play: "play", pause: "pause", volume: "volume",
  preview: "eye", eye: "eye", add: "plus", plus: "plus", delete: "trash", edit: "edit",
  download: "download", upload: "upload", logout: "logout", themeLight: "sun", themeDark: "moon",
  sidebar: "sidebar", minus: "minus", glyphMinus: "minus", more: "more", moreCircle: "more",
  menu: "menu", search: "search", refresh: "refresh", sort: "sort", reorder: "grip", grip: "grip",
  chevronLeft: "chev-left", chevronRight: "chev-right", chevronDown: "chev-down", chevronUp: "chev-up",
  arrowLeft: "arrow-left", arrowRight: "arrow-right", arrowUp: "arrow-up", arrowDown: "arrow-down",
  arrowUpRight: "external", externalLink: "external", fullscreen: "expand", exitFullscreen: "expand",
  undo: "undo", redo: "redo", editorUndo: "undo", editorRedo: "redo", egg: "egg", hen: "egg",
  feed: "feed", file: "text", fileCheck: "check-circle", fileAdd: "plus",
});

// Canvas icon ids accepted as-is (e.g. "globe", "key"), besides the semantic names.
const canvasIconIds = new Set([...Object.values(canvasIconNames), "key", "plug", "percent", "thermo", "wand", "cert", "grad", "medal", "route", "x", "x-circle", "check-circle"]);

function semanticNameOf(name) {
  return aapmIconSources[name] ? name : legacyIconAliases[name];
}

/** Resolve a semantic name, legacy alias, or raw source id to Solar icon data. */
export function resolveAapmIcon(name = "modules") {
  const semanticName = semanticNameOf(name);
  const source = semanticName ? aapmIconSources[semanticName] : name;

  if (typeof source === "string" && source.startsWith("aapm:")) {
    return aapmCustomIconData[source.slice(5)] || null;
  }

  return solarIconData[source] || null;
}

export default function AapmIcon({ name = "modules", className = "", alt = "", width = undefined, height = undefined, style = undefined, ...props }) {
  const canvas = canvasIconNames[semanticNameOf(name)] || (canvasIconIds.has(name) ? name : null);
  const a11y = {
    "aria-label": alt || undefined,
    "aria-hidden": alt ? undefined : true,
    role: alt ? "img" : undefined,
  };

  if (canvas) {
    const size = width || height;
    return (
      <span
        className={cn("ic", `ic-${canvas}`, "aapm-icon", className)}
        style={size ? { "--ic": typeof size === "number" ? `${size}px` : size, ...style } : style}
        {...a11y}
        {...props}
      />
    );
  }

  const data = resolveAapmIcon(name);
  // Unknown authored strings keep the legacy Iconify resolution path.
  const icon = data || (typeof name === "string" && name.includes(":") ? name : resolveAapmIcon("modules"));
  return <IconifyIcon icon={icon} width={width} height={height} style={style} className={cn("aapm-icon", className)} {...a11y} {...props} />;
}
