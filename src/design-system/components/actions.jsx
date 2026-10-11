import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

// Legacy shadcn/AAPM variant names map onto the canvas button vocabulary
// (academy.css §7): tactile primary/learn/secondary/ai/gold/danger faces on a
// darker ledge, plus ghost, soft and link.
const variantClass = {
  primary: "btn-primary",
  default: "btn-primary",
  learn: "btn-learn",
  secondary: "btn-secondary",
  outline: "btn-secondary",
  ghost: "btn-ghost",
  quiet: "btn-ghost btn-quiet",
  soft: "btn-soft",
  attention: "btn-ai",
  ai: "btn-ai",
  "ai-soft": "btn-ai-soft",
  gold: "btn-gold",
  danger: "btn-danger",
  destructive: "btn-danger",
  "danger-soft": "btn-danger-soft",
  link: "btn-link",
};

const sizeClass = {
  sm: "btn-sm",
  md: "",
  default: "",
  lg: "btn-lg",
  icon: "btn-icon",
  "icon-sm": "btn-sm btn-icon",
  "icon-lg": "btn-lg btn-icon",
};

/**
 * Canvas action (`.btn`). Hierarchy: primary (one per view) → secondary →
 * ghost; `learn` is the uppercase course CTA (continue, check answer), `ai`
 * belongs to APPI, `gold` to rewards.
 */
const Button = React.forwardRef(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    asChild = false,
    loading = false,
    block = false,
    shape,
    leadingIcon,
    trailingIcon,
    type,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const Component = asChild ? Slot : "button";
  const content = asChild ? children : (
    <>
      {loading ? <span className="aapm-spinner" aria-hidden="true" /> : leadingIcon ? <AapmIcon name={leadingIcon} /> : null}
      {children}
      {trailingIcon && !loading ? <AapmIcon name={trailingIcon} /> : null}
    </>
  );

  return (
    <Component
      ref={ref}
      type={asChild ? undefined : type || "button"}
      className={cn(
        "btn",
        variantClass[variant] ?? "btn-primary",
        sizeClass[size] ?? "",
        block && "btn-block",
        shape === "pill" && "btn-pill",
        asChild && disabled && "is-disabled",
        className,
      )}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      aria-disabled={asChild && disabled ? "true" : undefined}
      {...props}
    >
      {content}
    </Component>
  );
});

/** Compatibility helper for Radix slot consumers that only accept classes. */
function buttonVariants({ variant = "primary", size = "md" } = {}) {
  return cn("btn", variantClass[variant] ?? "btn-primary", sizeClass[size] ?? "");
}

const iconSizeAlias = { sm: "icon-sm", md: "icon", icon: "icon", lg: "icon-lg" };

/** Icon-only action. The label is always announced and shown as a tooltip. */
const IconButton = React.forwardRef(function IconButton(
  { label, tooltip = label, icon, children, variant = "quiet", size = "icon", side = "top", className, ...props },
  ref,
) {
  const control = (
    <Button
      ref={ref}
      variant={variant === "ghost" ? "quiet" : variant}
      size={iconSizeAlias[size] || "icon"}
      aria-label={label || tooltip || undefined}
      className={className}
      {...props}
    >
      {icon ? <AapmIcon name={icon} /> : children}
    </Button>
  );

  if (!tooltip) return control;
  return <Tooltip content={tooltip} side={side}>{control}</Tooltip>;
});

export { Button, buttonVariants, IconButton };
