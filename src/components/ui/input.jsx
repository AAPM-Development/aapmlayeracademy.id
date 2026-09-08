// @ts-nocheck
import * as React from "react"

import { Input as T7Input } from "@ten4seven/ui"

/**
 * Academy input compatibility wrapper. Ten4Seven owns field geometry, focus,
 * disabled, and error tokens while existing callers can keep their current
 * native-input props and separate Label components.
 */
/** @type {any} */
const Input = React.forwardRef(({ className, ...props }, ref) => (
  <T7Input ref={ref} className={className} {...props} />
))

Input.displayName = "Input"

export { Input }
