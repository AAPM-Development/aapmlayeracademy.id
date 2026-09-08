// @ts-nocheck
import * as React from "react"

import {
  Table as T7Table,
  TableBody as T7TableBody,
  TableCell as T7TableCell,
  TableHead as T7TableHead,
  TableHeader as T7TableHeader,
  TableRow as T7TableRow,
} from "@ten4seven/ui"
import { cn } from "@/lib/utils"

/** @type {any} */
const Table = ({ className, ...props } = {}) => (
  <T7Table
    className={className}
    data-t7-bridge="academy-table"
    {...props}
  />
)

/** @type {any} */
const TableHeader = ({ className, ...props } = {}) => (
  <T7TableHeader className={className} {...props} />
)

/** @type {any} */
const TableBody = ({ className, ...props } = {}) => (
  <T7TableBody className={className} {...props} />
)

/** @type {any} */
const TableRow = ({ className, ...props } = {}) => (
  <T7TableRow className={className} {...props} />
)

/** @type {any} */
const TableHead = ({ className, ...props } = {}) => (
  <T7TableHead className={className} {...props} />
)

/** @type {any} */
const TableCell = ({ className, ...props } = {}) => (
  <T7TableCell className={className} {...props} />
)

// Ten4Seven intentionally keeps the table contract small; these two legacy
// exports remain semantic native elements for compatibility with report views.
const TableFooter = React.forwardRef(({ className, ...props } = {}, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium", className)}
    {...props}
  />
))

const TableCaption = React.forwardRef(({ className, ...props } = {}, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
