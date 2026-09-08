import React from "react";
import { Icon as IconifyIcon } from "@iconify/react";
import { IconNames, T7Icon } from "@ten4seven/ui";
import { cn } from "@/lib/utils";
import { solarIconData } from "./solarIconData";

// APPI's semantic AI mark stays in the Iconify pipeline, but uses a local
// glyph so the product can own the legible "AI" silhouette instead of
// borrowing a generic magic-stick or CPU icon. It deliberately has no tile,
// border, or background; callers decide whether a surrounding control needs
// a surface.
export const aapmAiIconData = Object.freeze({
  body: [
    '<path fill="currentColor" fill-rule="evenodd" d="M3.25 40 13.5 8.75A2.5 2.5 0 0 1 15.87 7h4.28a2.5 2.5 0 0 1 2.38 1.75L32.75 40H26.1l-2.03-6.85H11.95L9.9 40H3.25Zm10.53-12.7h8.55l-4.28-14.1-4.27 14.1Z"/><path fill="currentColor" d="M34 7h6v33h-6z"/><path class="aapm-ai-mark__spark" d="m41.5 1.5 2.2 4.4 4.3 2.1-4.3 2.1-2.2 4.4-2.2-4.4L35 8l4.3-2.1 2.2-4.4Z"/>',
  ].join(""),
  height: 48,
  width: 48,
});

// Minimal UI's sidebar uses the Solar collection through Iconify. Keeping the
// semantic names here avoids scattering provider-specific icon strings across
// Academy features while preserving the intended duotone visual family.
export const aapmIconSources = Object.freeze({
  dashboard: "solar:home-angle-bold-duotone",
  course: "solar:notebook-bold-duotone",
  modules: "solar:notes-bold-duotone",
  assessment: "solar:file-text-bold",
  users: "solar:users-group-rounded-bold-duotone",
  analytics: "solar:chart-square-bold-duotone",
  kpi: "solar:chart-2-bold-duotone",
  ai: "aapm:ai-mark",
  certificate: "solar:verified-check-bold",
  media: "solar:gallery-wide-bold",
  menu: "solar:list-bold",
  close: "solar:close-circle-bold",
  chevronLeft: "solar:alt-arrow-left-linear",
  chevronRight: "solar:alt-arrow-right-linear",
  chevronDown: "solar:alt-arrow-down-linear",
  chevronUp: "solar:alt-arrow-up-linear",
  arrowLeft: "solar:alt-arrow-left-linear",
  arrowRight: "solar:alt-arrow-right-linear",
  undo: "solar:undo-left-round-linear",
  redo: "solar:undo-right-round-linear",
  logout: "solar:logout-3-bold",
  progress: "solar:chart-square-bold-duotone",
  themeLight: "solar:sun-2-bold-duotone",
  themeDark: "solar:moon-bold-duotone",
  lock: "solar:lock-keyhole-minimalistic-bold-duotone",
  mail: "solar:letter-bold-duotone",
  eye: "solar:eye-bold",
  eyeOff: "solar:eye-closed-bold",
  loading: "solar:restart-bold",
  add: "solar:add-circle-bold",
  search: "solar:card-search-bold-duotone",
  alert: "solar:danger-triangle-bold",
  alertCircle: "solar:danger-circle-bold",
  check: "solar:check-circle-bold",
  checkRead: "solar:check-read-bold-duotone",
  closeCircle: "solar:close-circle-bold",
  more: "solar:menu-dots-bold",
  minus: "solar:minus-circle-bold",
  sidebar: "solar:sidebar-minimalistic-bold-duotone",
  grip: "solar:sort-vertical-bold-duotone",
  flag: "solar:flag-2-bold",
  award: "solar:medal-ribbon-star-bold",
  graduation: "solar:medal-star-bold",
  refresh: "solar:restart-bold",
  edit: "solar:pen-new-square-bold",
  delete: "solar:trash-bin-trash-bold",
  egg: "solar:chart-2-bold-duotone",
  weight: "solar:scale-bold-duotone",
  finance: "solar:wallet-money-bold-duotone",
  trend: "solar:graph-up-bold-duotone",
  target: "solar:target-bold-duotone",
  shield: "solar:shield-check-bold",
  circle: "solar:record-circle-bold-duotone",
  play: "solar:play-circle-bold",
  download: "solar:download-minimalistic-bold",
  info: "solar:info-circle-bold",
  clock: "solar:clock-circle-bold",
  reorder: "solar:sort-vertical-bold-duotone",
  fileCheck: "solar:file-check-bold-duotone",
});

export const aapmIconNames = Object.freeze(Object.keys(aapmIconSources));

// The existing AAPM names stay stable for feature code while known glyphs are
// resolved to the canonical Ten4Seven semantic registry. Provider-specific
// Solar names remain supported below for authored content and legacy edge
// cases that have no canonical equivalent yet.
const semanticIconByAapmName = Object.freeze({
  dashboard: "dashboard",
  course: "book",
  modules: "book",
  assessment: "file",
  users: "users",
  analytics: "analytics",
  kpi: "kpi",
  certificate: "approve",
  media: "image",
  menu: "menu",
  close: "close",
  chevronLeft: "chevronLeft",
  chevronRight: "chevronRight",
  chevronDown: "chevronDown",
  chevronUp: "chevronUp",
  arrowLeft: "arrowLeft",
  arrowRight: "arrowRight",
  undo: "refresh",
  redo: "refresh",
  // There is no logout glyph in the canonical registry yet; keep the
  // authored Solar logout mark rather than changing the meaning to an arrow.
  progress: "progress",
  themeLight: "sun",
  themeDark: "moon",
  lock: "lock",
  mail: "communication",
  eye: "eye",
  eyeOff: "eyeOff",
  loading: "refresh",
  add: "add",
  search: "search",
  alert: "warning",
  alertCircle: "danger",
  check: "check",
  checkRead: "success",
  closeCircle: "close",
  more: "more",
  minus: "clear",
  sidebar: "sidebar",
  grip: "sort",
  flag: "warning",
  award: "approve",
  graduation: "approve",
  refresh: "refresh",
  edit: "edit",
  delete: "delete",
  egg: "chart",
  weight: "chart",
  finance: "finance",
  trend: "trendUp",
  target: "chart",
  shield: "admin",
  circle: "pending",
  play: "preview",
  download: "download",
  info: "info",
  clock: "clock",
  reorder: "sort",
  fileCheck: "fileCheck",
  settings: "settings",
});

function AiMark({ className = "", alt = "", ...props }) {
  // When a caller only sets a text size (for example in a badge), the mark
  // follows that text size. Explicit h/w utilities still win for icon buttons.
  const hasExplicitSize = /(?:^|\s)(?:h|w|size)-/.test(className);

  return <IconifyIcon
    icon={aapmAiIconData}
    className={cn("aapm-ai-mark", !hasExplicitSize && "h-[1em] w-[1em]", className)}
    role={alt ? "img" : undefined}
    aria-label={alt || undefined}
    aria-hidden={alt ? undefined : true}
    focusable="false"
    {...props}
  />;
}

export default function AapmIcon({ name = "dashboard", className = "", alt = "", ...props }) {
  const semanticName = semanticIconByAapmName[name];

  if (semanticName && IconNames.includes(semanticName)) {
    return (
      <T7Icon
        name={semanticName}
        label={alt || undefined}
        className={cn("h-5 w-5 shrink-0", className)}
        {...props}
      />
    );
  }

  const icon = aapmIconSources[name] || (name.includes(":") ? name : aapmIconSources.dashboard);

  if (name === "ai") return <AiMark className={className} alt={alt} {...props} />;

  return (
    <IconifyIcon
      icon={solarIconData[icon] || icon}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn("h-5 w-5 shrink-0", className)}
      {...props}
    />
  );
}
