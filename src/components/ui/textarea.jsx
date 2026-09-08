// @ts-nocheck
import * as React from "react"

import { Textarea as T7Textarea } from "@ten4seven/ui"

/** Keep the public Academy textarea API while using canonical field tokens. */
/** @type {any} */
const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <T7Textarea ref={ref} className={className} {...props} />
))

Textarea.displayName = "Textarea"

export { Textarea }
