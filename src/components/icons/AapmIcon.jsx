import React from "react";
import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  aapmCustomIconData,
  aapmIconSources,
  legacyIconAliases,
  solarIconData,
} from "@/design-system/icons/iconData";

// One icon family for the whole Academy: Solar (Bold Duotone for product,
// navigation and state; Linear for control glyphs), matching AAPM Farm.
// Feature code uses semantic names; authored/legacy Solar strings are folded
// back into the same semantic family so a page cannot mix weights.

export { aapmIconSources };
export const aapmIconNames = Object.freeze(Object.keys(aapmIconSources));

/** Resolve a semantic name, legacy alias, or raw source id to icon data. */
export function resolveAapmIcon(name = "modules") {
  const semanticName = aapmIconSources[name] ? name : legacyIconAliases[name];
  const source = semanticName ? aapmIconSources[semanticName] : name;

  if (typeof source === "string" && source.startsWith("aapm:")) {
    return aapmCustomIconData[source.slice(5)] || null;
  }

  return solarIconData[source] || null;
}

export default function AapmIcon({ name = "modules", className = "", alt = "", ...props }) {
  const data = resolveAapmIcon(name);
  // Unknown authored strings keep the legacy Iconify resolution path; every
  // name used by application code is bundled above.
  const icon = data || (typeof name === "string" && name.includes(":") ? name : resolveAapmIcon("modules"));

  return (
    <IconifyIcon
      icon={icon}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      className={cn("aapm-icon", className)}
      {...props}
    />
  );
}
