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
});

export const aapmIconNames = Object.freeze(Object.keys(aapmIconSources));

export default function AapmIcon({ name = "dashboard", className, alt = "", ...props }) {
  const icon = aapmIconSources[name] || aapmIconSources.dashboard;

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
