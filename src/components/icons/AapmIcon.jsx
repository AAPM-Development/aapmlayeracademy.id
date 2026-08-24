import React from "react";
import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";

// Minimal UI's sidebar uses the Solar collection through Iconify. Keeping the
// semantic names here avoids scattering provider-specific icon strings across
// Academy features while preserving the intended duotone visual family.
export const aapmIconSources = Object.freeze({
  dashboard: "solar:home-angle-bold-duotone",
  course: "solar:notebook-bold-duotone",
  modules: "solar:notes-bold-duotone",
  assessment: "solar:file-text-bold",
  users: "solar:users-group-rounded-bold-duotone",
  analytics: "solar:chart-square-outline",
  certificate: "solar:verified-check-bold",
  media: "solar:gallery-wide-bold",
  menu: "solar:list-bold",
  chevronLeft: "solar:alt-arrow-left-linear",
  chevronRight: "solar:alt-arrow-right-linear",
  arrowLeft: "solar:alt-arrow-left-linear",
  arrowRight: "solar:alt-arrow-right-linear",
  logout: "solar:logout-3-bold",
  progress: "solar:chart-square-outline",
  themeLight: "solar:sun-2-bold-duotone",
  themeDark: "solar:moon-bold-duotone",
  lock: "solar:lock-password-outline",
  mail: "solar:letter-bold",
  eye: "solar:eye-bold",
  eyeOff: "solar:eye-closed-bold",
  loading: "solar:restart-bold",
  add: "solar:add-circle-bold",
  search: "solar:magnifer-bold",
  alert: "solar:danger-triangle-bold",
  check: "solar:check-circle-bold",
  clock: "solar:clock-circle-bold",
  reorder: "solar:sort-vertical-bold-duotone",
  fileCheck: "solar:file-check-bold-duotone",
});

export const aapmIconNames = Object.freeze(Object.keys(aapmIconSources));

export default function AapmIcon({ name = "dashboard", className, alt = "", ...props }) {
  const icon = aapmIconSources[name] || (name.includes(":") ? name : aapmIconSources.dashboard);

  return (
    <IconifyIcon
      icon={icon}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn("h-5 w-5 shrink-0", className)}
      {...props}
    />
  );
}
