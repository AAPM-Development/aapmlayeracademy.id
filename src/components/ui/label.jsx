// @ts-nocheck
import * as React from "react"

import { Label as T7Label } from "@ten4seven/ui"

/** Label styling is owned by the Ten4Seven form contract. */
/** @type {any} */
const Label = React.forwardRef(({ className, ...props }, ref) => (
  <T7Label ref={ref} className={className} {...props} />
))

Label.displayName = "Label"

export { Label }
