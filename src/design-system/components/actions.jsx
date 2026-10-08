import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { Tooltip } from "./tooltip";

// Legacy shadcn variant names map onto the AAPM action vocabulary.
const variantAlias = {
  default: "primary",
  destructive: "danger",
  quiet: "ghost",
};

const sizeAlias = {
  default: "md",
  icon: "icon",
};

/**
 * AAPM action. Hierarchy: primary (one per view) → secondary/outline →
 * ghost; `learn` is the tactile course CTA (continue / check answer),
 * `attention` is reserved for APPI and time-sensitive learning prompts.
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
  const resolvedVariant = variantAlias[variant] || variant;
  const resolvedSize = sizeAlias[size] || size;
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
      className={cn("aapm-button", className)}
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      data-block={block ? "true" : undefined}
      data-shape={shape}
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
function buttonVariants() {
  return "aapm-button";
}

const iconSizeAlias = { sm: "icon-sm", md: "icon", icon: "icon", lg: "icon-lg" };

/** Icon-only action. The label is always announced and shown as a tooltip. */
const IconButton = React.forwardRef(function IconButton(
  { label, tooltip = label, icon, children, variant = "ghost", size = "icon", side = "top", ...props },
  ref,
) {
  const control = (
    <Button
      ref={ref}
      variant={variant}
      size={iconSizeAlias[size] || "icon"}
      aria-label={label || tooltip || undefined}
      {...props}
    >
      {icon ? <AapmIcon name={icon} /> : children}
    </Button>
  );

  if (!tooltip) return control;
  return <Tooltip content={tooltip} side={side}>{control}</Tooltip>;
});

export { Button, buttonVariants, IconButton };
