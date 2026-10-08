import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

/** Learning hues, in assignment order. Levels and categories cycle through them. */
export const LEARNING_HUES = Object.freeze(["green", "orange", "blue", "violet", "teal", "amber", "rose"]);

/** Stable hue for a level/category/index (1-based numbers or strings). */
export function hueFor(key) {
  if (typeof key === "number" && Number.isFinite(key)) {
    return LEARNING_HUES[(Math.max(1, Math.round(key)) - 1) % LEARNING_HUES.length];
  }
  const text = String(key || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return LEARNING_HUES[hash % LEARNING_HUES.length];
}

// Legacy tone names → AAPM hue or status vocabulary.
const legacyToneHue = { green: "green", lime: "teal", orange: "orange", blue: "blue", violet: "violet", slate: "neutral", neutral: undefined, success: "green", primary: "green", warning: "amber", danger: "rose", info: "blue", attention: "orange", ai: "orange" };

/* ------------------------------------------------------------ Chip/Badge */
const badgeToneByVariant = {
  default: "primary",
  primary: "primary",
  secondary: undefined,
  soft: undefined,
  outline: "outline",
  destructive: "danger",
  danger: "danger",
  success: "success",
  warning: "warning",
  info: "info",
  ai: "ai",
  attention: "attention",
  solid: "solid",
  inverse: "inverse",
};

/**
 * Compact status/category label. `tone` for status, `hue` for learning
 * category; `dot` adds a leading status dot so state is not colour-only.
 */
const Badge = React.forwardRef(function Badge({ className, variant = "secondary", tone, hue, dot = false, icon, size, children, ...props }, ref) {
  const resolvedTone = tone || badgeToneByVariant[variant];
  return (
    <span ref={ref} className={cn("aapm-chip", className)} data-tone={hue ? undefined : resolvedTone} data-hue={hue} data-size={size} {...props}>
      {dot ? <span className="aapm-chip__dot" aria-hidden="true" /> : null}
      {icon ? <AapmIcon name={icon} /> : null}
      {children}
    </span>
  );
});

function badgeVariants() {
  return "aapm-chip";
}

const Chip = Badge;

/* ----------------------------------------------------------------- Cards */
const Card = React.forwardRef(function Card({ className, variant, hue, interactive, as: Component = "div", ...props }, ref) {
  return (
    <Component
      ref={ref}
      className={cn("aapm-card", className)}
      data-variant={variant}
      data-hue={hue}
      data-interactive={interactive ? "true" : undefined}
      {...props}
    />
  );
});
const CardHeader = React.forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn("aapm-card__header", className)} {...props} />;
});
const CardTitle = React.forwardRef(function CardTitle({ className, as: Component = "h3", ...props }, ref) {
  return <Component ref={ref} className={cn("aapm-card__title", className)} {...props} />;
});
const CardDescription = React.forwardRef(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn("aapm-card__description", className)} {...props} />;
});
const CardContent = React.forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("aapm-card__content", className)} {...props} />;
});
const CardFooter = React.forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn("aapm-card__footer", className)} {...props} />;
});

const surfaceVariantMap = {
  default: undefined,
  muted: "muted",
  accent: "selected",
  selected: "selected",
  inverse: "inverse",
  interactive: undefined,
  outline: "outline",
  dashed: "dashed",
  raised: "raised",
};

/**
 * Generic bounded region. Prefer composition without a container; use a
 * Surface only when grouping clarifies a relationship.
 */
const Surface = React.forwardRef(function Surface({ as: Component = "div", className, variant = "default", tone = "neutral", hue, interactive, ...props }, ref) {
  const resolvedHue = hue || legacyToneHue[tone];
  return (
    <Component
      ref={ref}
      className={cn("aapm-surface", className)}
      data-variant={surfaceVariantMap[variant] ?? variant}
      data-hue={resolvedHue}
      data-interactive={interactive || variant === "interactive" ? "true" : undefined}
      {...props}
    />
  );
});

function surfaceVariants() {
  return "aapm-surface";
}

/* ------------------------------------------------------------- Icon tile */
const IconTile = React.forwardRef(function IconTile({ className, icon, tone, hue, size = "md", shape, variant, label, ...props }, ref) {
  if (!icon) return null;
  const resolvedHue = hue || legacyToneHue[tone];
  return (
    <span
      ref={ref}
      className={cn("aapm-icon-tile", className)}
      data-hue={resolvedHue}
      data-size={size}
      data-shape={shape}
      data-variant={variant}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {typeof icon === "string" ? <AapmIcon name={icon} /> : React.createElement(icon, { "aria-hidden": true, className: "aapm-icon" })}
    </span>
  );
});

function iconTileVariants() {
  return "aapm-icon-tile";
}

/* ---------------------------------------------------------------- Avatar */
const Avatar = React.forwardRef(function Avatar({ className, ...props }, ref) {
  return <AvatarPrimitive.Root ref={ref} className={cn("aapm-avatar", className)} {...props} />;
});
const AvatarImage = React.forwardRef(function AvatarImage({ className, ...props }, ref) {
  return <AvatarPrimitive.Image ref={ref} className={cn("h-full w-full object-cover", className)} {...props} />;
});
const AvatarFallback = React.forwardRef(function AvatarFallback({ className, ...props }, ref) {
  return <AvatarPrimitive.Fallback ref={ref} className={cn("grid h-full w-full place-items-center", className)} {...props} />;
});

/* -------------------------------------------------------------- Feedback */
const Separator = React.forwardRef(function Separator({ className, orientation = "horizontal", decorative = true, ...props }, ref) {
  return <SeparatorPrimitive.Root ref={ref} decorative={decorative} orientation={orientation} className={cn("aapm-separator", className)} data-orientation={orientation} {...props} />;
});

function Skeleton({ className, ...props }) {
  return <div className={cn("aapm-skeleton", className)} aria-hidden="true" {...props} />;
}

function Spinner({ className, size, label = "Memuat", ...props }) {
  return <span role="status" aria-label={label} className={cn("aapm-spinner", className)} data-size={size} {...props} />;
}

function Kbd({ className, ...props }) {
  return <kbd className={cn("aapm-kbd", className)} {...props} />;
}

const alertIconByTone = { success: "check", warning: "warning", danger: "danger", info: "info", ai: "ai", neutral: "info" };

/** Inline, persistent message tied to a region (not a transient toast). */
function Alert({ tone = "neutral", title, description, icon, action, className, children, ...props }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("aapm-alert", className)} data-tone={tone} {...props}>
      <AapmIcon name={icon || alertIconByTone[tone] || "info"} />
      <div className="min-w-0">
        {title ? <p className="aapm-alert__title">{title}</p> : null}
        {description ? <p className="aapm-alert__description">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="flex items-center">{action}</div> : <span />}
    </div>
  );
}

/* -------------------------------------------------------------- Progress */
function clampPercent(value, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !max) return 0;
  return Math.min(100, Math.max(0, (numeric / max) * 100));
}

const Progress = React.forwardRef(function Progress({ className, value = 0, max = 100, tone, hue, size, onTint, label, ...props }, ref) {
  const percent = clampPercent(value, max);
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Number(value) || 0}
      aria-label={label || props["aria-label"]}
      className={cn("aapm-progress", className)}
      data-tone={tone}
      data-hue={hue}
      data-size={size}
      data-on-tint={onTint ? "true" : undefined}
      {...props}
    >
      <div className="aapm-progress__fill" style={{ width: `${percent}%` }} />
    </div>
  );
});

/** Discrete step progress (quiz questions, lesson sections). */
function Segments({ total = 0, current = 0, states = [], className, label, ...props }) {
  const count = Math.max(0, Math.min(60, Number(total) || 0));
  return (
    <div className={cn("aapm-segments", className)} role="progressbar" aria-valuemin={0} aria-valuemax={count} aria-valuenow={current} aria-label={label} {...props}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} data-state={states[index] || (index < current ? "done" : index === current ? "current" : undefined)} />
      ))}
    </div>
  );
}

/** Circular progress (course completion, level ring). */
function ProgressRing({ value = 0, max = 100, size = 56, stroke = 6, hue, label, showValue = true, children, className, ...props }) {
  const percent = clampPercent(value, max);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className={cn("aapm-ring", className)}
      data-hue={hue}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-label={label}
      {...props}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="aapm-ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="aapm-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          style={{ "--ring-circumference": circumference }}
        />
      </svg>
      {children ? <span className="aapm-ring__label">{children}</span> : showValue ? <span className="aapm-ring__label">{Math.round(percent)}%</span> : null}
    </div>
  );
}

/** Former T7 CircularProgress contract. */
function CircularProgress({ value = 0, max = 100, size = 56, label, className, ...props }) {
  return <ProgressRing value={value} max={max} size={size} label={label} className={className} {...props} />;
}

/* ------------------------------------------------------------ State view */
/**
 * Loading / empty / error / success in one anatomy so every route explains
 * what happened and what to do next.
 */
function StateView({
  kind = "empty",
  icon,
  hue,
  title,
  titleAs: TitleTag = "h2",
  description,
  action,
  secondaryAction,
  framed = true,
  compact = false,
  size,
  className,
  children,
}) {
  // A state that stands in for a whole page (404, access denied) carries the
  // page h1, so it takes the page title scale and the larger icon tile.
  const isPage = size === "page" || TitleTag === "h1";
  const defaults = {
    loading: { icon: null, hue: "neutral" },
    empty: { icon: "folder", hue: "neutral" },
    error: { icon: "danger", hue: "rose" },
    success: { icon: "check", hue: "green" },
    locked: { icon: "lock", hue: "neutral" },
  }[kind] || {};

  return (
    <div
      className={cn("aapm-state", className)}
      data-framed={framed ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
      data-size={isPage ? "page" : undefined}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
    >
      {kind === "loading" ? (
        <Spinner size="lg" className="text-primary" label={title || "Memuat"} />
      ) : (
        <IconTile icon={icon || defaults.icon} hue={hue || defaults.hue} size={isPage ? "xl" : "lg"} shape="circle" />
      )}
      {title ? <TitleTag className="aapm-state__title">{title}</TitleTag> : null}
      {description ? <p className="aapm-state__description">{description}</p> : null}
      {children}
      {action || secondaryAction ? (
        // Primary first in reading order; CSS keeps it on the right when the
        // pair sits in a row and on top when it stacks.
        <div className="aapm-state__actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export {
  Badge,
  badgeVariants,
  Chip,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Surface,
  surfaceVariants,
  IconTile,
  iconTileVariants,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Separator,
  Skeleton,
  Spinner,
  Kbd,
  Alert,
  Progress,
  Segments,
  ProgressRing,
  CircularProgress,
  StateView,
};
