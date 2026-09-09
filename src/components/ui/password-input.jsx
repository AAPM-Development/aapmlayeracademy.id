// @ts-nocheck
import * as React from "react"

import { PasswordInput as T7PasswordInput } from "@ten4seven/ui"

/**
 * Academy password input facade. The canonical Ten4Seven primitive owns the
 * reveal action, control radius, border, and focus ring so the action cannot
 * introduce a second visual shell inside the field.
 */
/** @type {any} */
const PasswordInput = React.forwardRef(({ className, ...props }, ref) => (
  <T7PasswordInput ref={ref} className={className} {...props} />
))

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
