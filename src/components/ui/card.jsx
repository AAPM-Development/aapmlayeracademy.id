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
const Card = bridge(T7Card, "card")
const CardHeader = bridge(T7CardHeader, "card-header")
const CardFooter = bridge(T7CardFooter, "card-footer")
const CardTitle = bridge(T7CardTitle, "card-title")
const CardDescription = bridge(T7CardDescription, "card-description")
const CardContent = bridge(T7CardContent, "card-content")

Card.displayName = "Card"
CardHeader.displayName = "CardHeader"
CardFooter.displayName = "CardFooter"
CardTitle.displayName = "CardTitle"
CardDescription.displayName = "CardDescription"
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
