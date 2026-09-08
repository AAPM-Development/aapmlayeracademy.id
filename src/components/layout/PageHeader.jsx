import React from "react";
import { PageHeader as T7PageHeader } from "@ten4seven/ui";
import { cn } from "@/lib/utils";

/** Route-level heading backed by the canonical Ten4Seven page-header anatomy. */
/** @type {any} */
const AcademyPageHeader = function AcademyPageHeader({
  eyebrow = "",
  title = "",
  description = "",
  actions = null,
  className = "",
  ...props
} = {}) {
  return (
    <T7PageHeader
      overline={eyebrow || undefined}
      title={title}
      description={description || undefined}
      actions={actions}
      className={cn("mb-7", className)}
      data-t7-bridge="academy-page-header"
      {...props}
    />
  );
}

export default AcademyPageHeader;
