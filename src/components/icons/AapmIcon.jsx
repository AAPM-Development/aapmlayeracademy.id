import React from "react";
import { Icon as IconifyIcon } from "@iconify/react";
import { IconNames, T7Icon } from "@ten4seven/ui";
import { cn } from "@/lib/utils";
import { solarIconData } from "./solarIconData";

// Ten4Seven does not currently expose a truthful AI glyph. APPI therefore
// uses the local Solar sparkle source below and lets the T7 token bridge own
// its size and colour; no bespoke mark is embedded in the component.

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
  ai: "solar:stars-minimalistic-bold-duotone",
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
  // Rich-text actions keep directional Office-like marks. These aliases use
  // the local Solar source until the Ten4Seven registry exposes truthful
  // link/history semantics; they still inherit the shared icon size/color
  // tokens through AapmIcon.
  editorLink: "solar:link-minimalistic-linear",
  editorUnlink: "solar:link-broken-minimalistic-linear",
  editorUndo: "solar:undo-left-round-linear",
  editorRedo: "solar:undo-right-round-linear",
  imageAlignLeft: "solar:align-left-linear",
  imageAlignCenter: "solar:align-horizontal-center-linear",
  imageAlignRight: "solar:align-right-linear",
  imageFit: "solar:maximize-square-minimalistic-linear",
  imageNatural: "solar:scale-linear",
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
  trendUp: "solar:graph-up-bold-duotone",
  trendDown: "solar:graph-down-bold-duotone",
  target: "solar:target-bold-duotone",
  shield: "solar:shield-check-bold",
  circle: "solar:record-circle-bold-duotone",
  play: "solar:play-circle-bold",
  download: "solar:download-minimalistic-bold",
  info: "solar:info-circle-bold",
  clock: "solar:clock-circle-bold",
  reorder: "solar:sort-vertical-bold-duotone",
  fileCheck: "solar:file-check-bold-duotone",
  communication: "communication",
  revenue: "revenue",
  medicine: "medicine",
  pills: "pills",
  cashOnDelivery: "cashOnDelivery",
  wallet: "wallet",
  triangleRight: "triangleRight",
  triangleLeft: "triangleLeft",
  triangleUp: "triangleUp",
  triangleDown: "triangleDown",
  barn: "barn",
  eggCrack: "eggCrack",
  eggPair: "eggPair",
  chicken: "chicken",
  chick: "chick",
  graph: "solar:graph-bold-duotone",
  graphMemory: "iconmind:graph-memory-duotone-regular",
  marginalRoi: "iconmind:marginal-roi-duotone-regular",
  hvac: "ic:twotone-hvac",
  waterRate: "icon-park-twotone:water-rate-two",
  mortality: "ph:skull-duotone",
  breakEven: "iconmind:break-even-duotone-regular",
  equalRatio: "icon-park-twotone:equal-ratio",
});

export const aapmIconNames = Object.freeze(Object.keys(aapmIconSources));

// The existing AAPM names stay stable for feature code while known glyphs are
// resolved to the canonical Ten4Seven semantic registry. Provider-specific
// Solar names remain supported below for authored content and legacy edge
// cases that have no canonical equivalent yet.
const semanticIconByAapmName = Object.freeze({
  dashboard: "dashboard",
  course: "book",
  book: "book",
  modules: "book",
  assessment: "file",
  file: "file",
  image: "image",
  table: "table",
  type: "type",
  users: "users",
  analytics: "analytics",
  kpi: "kpi",
  // Dashboard metrics use the same semantic registry as KPICluster. Keeping
  // these aliases here means a standalone IconTile or action row cannot fall
  // back to the dashboard glyph just because it uses a metric-oriented name.
  chart: "chart",
  package: "package",
  warning: "warning",
  danger: "danger",
  shield: "admin",
  farm: "farm",
  settings: "settings",
  finance: "finance",
  preview: "preview",
  link: "arrowRight",
  list: "table",
  clear: "clear",
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
  // T7 does not expose a truthful history glyph yet. Keep these authored
  // Solar arrows intact instead of substituting the generic refresh icon.
  // There is no logout glyph in the canonical registry yet; keep the
  // authored Solar logout mark rather than changing the meaning to an arrow.
  progress: "progress",
  themeLight: "sun",
  themeDark: "moon",
  lock: "lock",
  // Ten4Seven does not currently expose a truthful email glyph. Let the
  // approved Solar letter source render below instead of substituting a
  // conversation bubble and changing the field's meaning.
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
  revenue: "revenue",
  medicine: "medicine",
  pills: "pills",
  cashOnDelivery: "cashOnDelivery",
  wallet: "wallet",
  triangleRight: "triangleRight",
  triangleLeft: "triangleLeft",
  triangleUp: "triangleUp",
  triangleDown: "triangleDown",
  barn: "barn",
  eggCrack: "eggCrack",
  eggPair: "eggPair",
  egg: "egg",
  chicken: "chicken",
  chick: "chick",
  graph: "graph",
  graphMemory: "graphMemory",
  marginalRoi: "marginalRoi",
  hvac: "hvac",
  waterRate: "waterRate",
  mortality: "mortality",
  breakEven: "breakEven",
  equalRatio: "equalRatio",
  weight: "weight",
  trendUp: "trendUp",
  trendDown: "trendDown",
  trend: "trendUp",
  target: "chart",
  circle: "pending",
  play: "preview",
  download: "download",
  info: "info",
  clock: "clock",
  reorder: "sort",
  fileCheck: "fileCheck",
  communication: "communication",
});

// A few authored Academy surfaces still pass their historical Solar name
// directly (lesson sections, roadmap metadata, APPI history, etc.). Resolve
// those names through the same Ten4Seven registry whenever a truthful semantic
// equivalent exists. Unknown/author-provided Solar names intentionally keep
// the Iconify fallback below so this bridge remains backward-compatible.
const semanticIconBySourceName = Object.freeze({
  "solar:home-angle-bold-duotone": "dashboard",
  "solar:notebook-bold-duotone": "book",
  "solar:notes-bold-duotone": "book",
  "solar:file-text-bold": "file",
  "solar:file-check-bold-duotone": "fileCheck",
  "solar:users-group-rounded-bold-duotone": "users",
  "solar:chart-square-bold-duotone": "analytics",
  "solar:chart-2-bold-duotone": "chart",
  "solar:chart-square-outline": "chart",
  "solar:gallery-wide-bold": "image",
  "solar:gallery-add-bold-duotone": "image",
  "solar:list-bold": "table",
  "solar:close-circle-bold": "close",
  "solar:alt-arrow-left-linear": "chevronLeft",
  "solar:alt-arrow-right-linear": "chevronRight",
  "solar:alt-arrow-down-linear": "chevronDown",
  "solar:alt-arrow-up-linear": "chevronUp",
  "solar:arrow-right-bold": "arrowRight",
  "solar:arrow-right-up-bold": "arrowRight",
  "solar:sun-2-bold-duotone": "sun",
  "solar:moon-bold-duotone": "moon",
  "solar:lock-keyhole-bold-duotone": "lock",
  "solar:lock-keyhole-minimalistic-bold-duotone": "lock",
  "solar:lock-keyhole-minimalistic-unlocked-bold-duotone": "lock",
  // Keep a letter as a letter for authored email fields. The canonical
  // registry has no email icon yet, so this intentionally uses the Iconify
  // compatibility path rather than a semantically different chat glyph.
  "solar:eye-bold": "eye",
  "solar:eye-closed-bold": "eyeOff",
  "solar:restart-bold": "refresh",
  "solar:refresh-circle-bold-duotone": "refresh",
  "solar:add-circle-bold": "add",
  "solar:card-search-bold-duotone": "search",
  "solar:danger-triangle-bold": "warning",
  "solar:danger-circle-bold": "danger",
  "solar:check-circle-bold": "check",
  "solar:check-read-bold-duotone": "success",
  "solar:menu-dots-bold": "more",
  "solar:minus-circle-bold": "clear",
  "solar:sidebar-minimalistic-bold-duotone": "sidebar",
  "solar:sort-vertical-bold-duotone": "sort",
  "solar:flag-2-bold": "warning",
  "solar:flag-2-bold-duotone": "warning",
  "solar:medal-ribbon-star-bold": "approve",
  "solar:medal-star-bold": "approve",
  "solar:diploma-verified-bold-duotone": "approve",
  "solar:trash-bin-trash-bold": "delete",
  "solar:wallet-money-bold-duotone": "finance",
  // Curated graph sources from authored data converge on one canonical
  // Ten4Seven semantic family instead of loading provider-specific variants.
  "solar:graph-bold-duotone": "graph",
  "solar:graph-up-bold-duotone": "trendUp",
  "solar:graph-down-bold-duotone": "trendDown",
  "reicon:graph-duotone": "graph",
  "reicon:graph-up-duotone": "trendUp",
  "reicon:graph-down-duotone": "trendDown",
  "reicon:graph-up2-duotone": "trendUp",
  "reicon:graph-down2-duotone": "trendDown",
  "iconoir:graph-up": "trendUp",
  "iconoir:graph-down": "trendDown",
  "iconmind:graph-memory-duotone-regular": "graphMemory",
  "iconmind:marginal-roi-duotone-regular": "marginalRoi",
  "iconmind:break-even-duotone-thin": "breakEven",
  "iconmind:break-even-duotone-regular": "breakEven",
  "ic:twotone-hvac": "hvac",
  "icon-park-twotone:water-rate-two": "waterRate",
  "fa6-solid:skull-crossbones": "mortality",
  "icon-park-twotone:equal-ratio": "equalRatio",
  "icon-park-twotone:weight": "weight",
  "solar:target-bold-duotone": "target",
  "solar:record-circle-bold": "pending",
  "solar:record-circle-bold-duotone": "pending",
  "solar:play-circle-bold": "preview",
  "solar:play-circle-bold-duotone": "preview",
  "solar:download-minimalistic-bold": "download",
  "solar:info-circle-bold": "info",
  "solar:info-circle-bold-duotone": "info",
  "solar:clock-circle-bold": "clock",
  "solar:layers-bold-duotone": "package",
  "solar:settings-minimalistic-bold-duotone": "settings",
  "solar:waterdrops-bold-duotone": "farm",
  "solar:wind-bold-duotone": "farm",
  "solar:medical-kit-bold": "danger",
  "solar:lightbulb-bolt-bold-duotone": "info",
  "solar:route-bold-duotone": "timeline",
  "solar:camera-bold-duotone": "image",
});

// Export the same semantic bridge used by IconButton so an icon rendered as a
// control and an icon rendered inline cannot silently drift to different T7
// glyphs as the registry grows.
export const aapmSemanticIconNames = semanticIconByAapmName;

export default function AapmIcon({ name = "dashboard", className = "", alt = "", ...props }) {
  const semanticName = semanticIconByAapmName[name] || semanticIconBySourceName[name];

  if (semanticName && IconNames.includes(semanticName)) {
    return (
      <T7Icon
        name={semanticName}
        label={alt || undefined}
        className={cn("aapm-icon h-[var(--icon-size-control)] w-[var(--icon-size-control)] shrink-0", className)}
        data-t7-bridge="academy-icon"
        {...props}
      />
    );
  }

  const icon = aapmIconSources[name] || (name.includes(":") ? name : aapmIconSources.dashboard);

  return (
    <IconifyIcon
      icon={solarIconData[icon] || icon}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn("aapm-icon h-[var(--icon-size-control)] w-[var(--icon-size-control)] shrink-0", className)}
      data-t7-bridge="academy-icon"
      {...props}
    />
  );
}
