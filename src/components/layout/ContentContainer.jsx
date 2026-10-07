import React from "react";
import { Page } from "@/design-system/patterns/AppShell";

/** Route content container (AAPM page width, inset and rhythm). */
export default function ContentContainer({ children = null, width, className = "", ...props } = {}) {
  return (
    <Page width={width} className={className} {...props}>
      {children}
    </Page>
  );
}
