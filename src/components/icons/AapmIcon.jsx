import React from "react";
import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { solarIconData } from "./solarIconData";

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
  ai: "solar:cpu-bolt-bold-duotone",
  certificate: "solar:verified-check-bold",
  media: "solar:gallery-wide-bold",
  menu: "solar:list-bold",
  close: "solar:close-circle-bold",
  chevronLeft: "solar:alt-arrow-left-linear",
  chevronRight: "solar:alt-arrow-right-linear",
  arrowLeft: "solar:alt-arrow-left-linear",
  arrowRight: "solar:alt-arrow-right-linear",
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

export default function AapmIcon({ name = "dashboard", className = "", alt = "", ...props }) {
  const icon = aapmIconSources[name] || (name.includes(":") ? name : aapmIconSources.dashboard);

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
