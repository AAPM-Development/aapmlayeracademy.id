// @ts-nocheck
import * as React from "react"

import {
  Card as T7Card,
  CardContent as T7CardContent,
  CardDescription as T7CardDescription,
  CardFooter as T7CardFooter,
  CardHeader as T7CardHeader,
  CardTitle as T7CardTitle,
} from "@ten4seven/ui"

/** @type {any} */
const bridge = (Component, name) =>
  React.forwardRef(({ className, ...props } = {}, ref) => (
    <Component
      ref={ref}
      className={className}
      data-t7-bridge={`academy-${name}`}
      {...props}
    />
  ))

/** Card anatomy now consumes Ten4Seven surface and typography tokens. */
/** @type {any} */
const AcademyCard = bridge(T7Card, "card")
const AcademyCardHeader = bridge(T7CardHeader, "card-header")
const AcademyCardFooter = bridge(T7CardFooter, "card-footer")
const AcademyCardTitle = bridge(T7CardTitle, "card-title")
const AcademyCardDescription = bridge(T7CardDescription, "card-description")
const AcademyCardContent = bridge(T7CardContent, "card-content")

AcademyCard.displayName = "Card"
AcademyCardHeader.displayName = "CardHeader"
AcademyCardFooter.displayName = "CardFooter"
AcademyCardTitle.displayName = "CardTitle"
AcademyCardDescription.displayName = "CardDescription"
AcademyCardContent.displayName = "CardContent"

export {
  AcademyCard as Card,
  AcademyCardHeader as CardHeader,
  AcademyCardFooter as CardFooter,
  AcademyCardTitle as CardTitle,
  AcademyCardDescription as CardDescription,
  AcademyCardContent as CardContent,
}
