import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import AapmIcon from "@/components/icons/AapmIcon";
import AppiMascot from "@/components/appi/AppiMascot";
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

// Legacy tone names → canvas hue vocabulary.
const legacyToneHue = { green: "green", lime: "teal", orange: "orange", blue: "blue", violet: "violet", slate: "neutral", neutral: undefined, success: "green", primary: "green", warning: "amber", danger: "rose", info: "blue", attention: "ai", ai: "ai" };

/* ------------------------------------------------------------ Chip/Badge */
const chipClassByTone = {
  primary: "chip-hue",
  success: "chip-success",
  warning: "chip-warning",
  danger: "chip-danger",
  info: "chip-info",
  ai: "chip-ai",
  attention: "chip-ai",
  outline: "chip-outline",
  solid: "chip-solid",
  inverse: "chip-solid",
  gold: "chip-gold",
};
const toneByVariant = { default: "primary", primary: "primary", outline: "outline", destructive: "danger", danger: "danger", success: "success", warning: "warning", info: "info", ai: "ai", attention: "attention", solid: "solid", inverse: "inverse", gold: "gold" };

/**
 * Compact status/category label (`.chip`). `tone` for status, `hue` for a
 * learning category; `dot` adds a leading dot so state is not colour-only.
 */
const Badge = React.forwardRef(/** @param {any} props @param {any} ref */ function Badge({ className, variant = "secondary", tone, hue, dot = false, icon, size, children, ...props }, ref) {
  const resolvedTone = tone || toneByVariant[variant];
  const toneClass = hue ? (resolvedTone === "solid" ? "chip-solid" : "chip-hue") : chipClassByTone[resolvedTone];
  return (
    <span
      ref={ref}
      className={cn("chip", toneClass, size === "lg" && "chip-lg", dot && "chip-dot", className)}
      data-hue={hue || (resolvedTone === "inverse" ? "neutral" : undefined)}
      {...props}
    >
      {icon ? <AapmIcon name={icon} /> : null}
      {children}
    </span>
  );
});

function badgeVariants({ tone = undefined } = {}) {
  return cn("chip", chipClassByTone[tone]);
}

const Chip = Badge;

/* ----------------------------------------------------------------- Cards */
const cardClassByVariant = {
  muted: "card-muted",
  tint: "card-tint",
  fill: "card-fill",
  raised: "card-raised",
  dashed: "card-dashed",
  selected: "card-selected",
  accent: "card-selected",
  tactile: "card-tactile",
  interactive: "card-link",
};

const Card = React.forwardRef(/** @param {any} props @param {any} ref */ function Card({ className, variant, hue, interactive, as: Component = "div", ...props }, ref) {
  return (
    <Component
      ref={ref}
      className={cn("card", cardClassByVariant[variant], interactive && "card-link", className)}
      data-hue={hue}
      {...props}
    />
  );
});
const CardHeader = React.forwardRef(/** @param {any} props @param {any} ref */ function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn("card-pad stack gap-0-5", className)} {...props} />;
});
const CardTitle = React.forwardRef(/** @param {any} props @param {any} ref */ function CardTitle({ className, as: Component = "h3", ...props }, ref) {
  return <Component ref={ref} className={cn("card-title", className)} {...props} />;
});
const CardDescription = React.forwardRef(/** @param {any} props @param {any} ref */ function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn("card-desc", className)} {...props} />;
});
const CardContent = React.forwardRef(/** @param {any} props @param {any} ref */ function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("card-pad", className)} {...props} />;
});
const CardFooter = React.forwardRef(/** @param {any} props @param {any} ref */ function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn("card-foot", className)} {...props} />;
});

/**
 * Generic bounded region (`.card`). Prefer composition without a container;
 * use a Surface only when grouping clarifies a relationship.
 */
const Surface = React.forwardRef(/** @param {any} props @param {any} ref */ function Surface({ as: Component = "div", className, variant = "default", tone = "neutral", hue, interactive, ...props }, ref) {
  const resolvedHue = hue || legacyToneHue[tone];
  const variantClass = cardClassByVariant[variant] || (resolvedHue && variant === "default" ? "card-tint" : undefined);
  return (
    <Component
      ref={ref}
      className={cn("card", variantClass, (interactive || variant === "interactive") && "card-link", className)}
      data-hue={resolvedHue}
      {...props}
    />
  );
});

function surfaceVariants({ variant = undefined } = {}) {
  return cn("card", cardClassByVariant[variant]);
}

/* ------------------------------------------------------------- Icon tile */
const tileSizeClass = { xs: "tile-xs", sm: "tile-sm", md: undefined, lg: "tile-lg", xl: "tile-xl" };

const IconTile = React.forwardRef(/** @param {any} props @param {any} ref */ function IconTile({ className = undefined, icon = undefined, tone = undefined, hue = undefined, size = "md", shape = undefined, variant = undefined, label = undefined, ...props }, ref) {
  if (!icon) return null;
  const resolvedHue = hue || legacyToneHue[tone];
  return (
    <span
      ref={ref}
      className={cn("tile", tileSizeClass[size], shape === "circle" && "tile-round", (variant === "solid" || variant === "badge") && "tile-solid", className)}
      data-hue={resolvedHue}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {typeof icon === "string" ? <AapmIcon name={icon} /> : React.createElement(icon, { "aria-hidden": true, className: "ic" })}
    </span>
  );
});

function iconTileVariants({ size = undefined } = {}) {
  return cn("tile", tileSizeClass[size]);
}

/* ---------------------------------------------------------------- Avatar */
const Avatar = React.forwardRef(/** @param {any} props @param {any} ref */ function Avatar({ className, ...props }, ref) {
  return <AvatarPrimitive.Root ref={ref} className={cn("avatar", className)} data-hue="green" {...props} />;
});
const AvatarImage = React.forwardRef(/** @param {any} props @param {any} ref */ function AvatarImage({ className, ...props }, ref) {
  return <AvatarPrimitive.Image ref={ref} className={cn("h-full w-full object-cover", className)} {...props} />;
});
const AvatarFallback = React.forwardRef(/** @param {any} props @param {any} ref */ function AvatarFallback({ className, ...props }, ref) {
  return <AvatarPrimitive.Fallback ref={ref} className={cn("grid h-full w-full place-items-center", className)} {...props} />;
});

/* -------------------------------------------------------------- Feedback */
const Separator = React.forwardRef(/** @param {any} props @param {any} ref */ function Separator({ className, orientation = "horizontal", decorative = true, ...props }, ref) {
  return <SeparatorPrimitive.Root ref={ref} decorative={decorative} orientation={orientation} className={cn(orientation === "vertical" ? "vr" : "divider", className)} {...props} />;
});

function Skeleton({ className = undefined, ...props }) {
  return <div className={cn("skel", className)} aria-hidden="true" {...props} />;
}

/** Inline wait indicator: the canvas typing dots. */
function Spinner({ className = undefined, size = undefined, label = "Memuat", ...props }) {
  return (
    <span role="status" aria-label={label} className={cn("typing", className)} data-size={size} {...props}>
      <i /><i /><i />
    </span>
  );
}

function Kbd({ className, ...props }) {
  return <kbd className={cn("kbd", className)} {...props} />;
}

const alertIconByTone = { success: "success", warning: "warning", danger: "danger", info: "info", ai: "ai", neutral: "info" };
const alertClassByTone = { success: "alert-success", warning: "alert-warning", danger: "alert-danger", info: "alert-info", ai: "alert-ai" };

/** Inline, persistent message tied to a region (`.alert`), not a toast. */
function Alert({ tone = "neutral", title, description, icon, action, className, children, ...props }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("alert", alertClassByTone[tone], className)} {...props}>
      <AapmIcon name={icon || alertIconByTone[tone] || "info"} />
      <div className="stack gap-0-5 grow">
        {title ? <p className="alert-title">{title}</p> : null}
        {description ? <p className="t-support">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="row gap-2 alert-action">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- Progress */
function clampPercent(value, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !max) return 0;
  return Math.min(100, Math.max(0, (numeric / max) * 100));
}

const progressHueByTone = { success: "green", warning: "amber", danger: "rose", info: "blue", ai: "ai", primary: "green" };

/** Progress bar (`.bar`). */
const Progress = React.forwardRef(/** @param {any} props @param {any} ref */ function Progress({ className, value = 0, max = 100, tone, hue, size, onTint, label, animate = false, ...props }, ref) {
  const percent = clampPercent(value, max);
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Number(value) || 0}
      aria-label={label || props["aria-label"]}
      className={cn("bar", size === "sm" && "bar-sm", size === "lg" && "bar-lg", size === "xl" && "bar-xl", onTint && "bar-on-tint", animate && "anim-fill", className)}
      data-hue={hue || progressHueByTone[tone]}
      style={{ "--p": Math.round(percent) }}
      {...props}
    >
      {percent > 0 ? <i /> : null}
    </div>
  );
});

/** Discrete step progress (`.segs`): quiz questions, lesson sections. */
function Segments({ total = 0, current = 0, states = [], className, label, ...props }) {
  const count = Math.max(0, Math.min(60, Number(total) || 0));
  const stateClass = { done: "on", correct: "on", current: "cur", wrong: "bad", bad: "bad" };
  return (
    <div className={cn("segs", className)} role="progressbar" aria-valuemin={0} aria-valuemax={count} aria-valuenow={current} aria-label={label} {...props}>
      {Array.from({ length: count }, (_, index) => {
        const state = states[index] || (index < current ? "done" : index === current ? "current" : undefined);
        return <i key={index} className={stateClass[state]} />;
      })}
    </div>
  );
}

/** Circular progress (`.progress-ring`): course completion, level ring. */
function ProgressRing({ value = 0, max = 100, size = 56, stroke = 5, hue = undefined, label = undefined, showValue = true, children = undefined, animate = false, className = undefined, ...props }) {
  const percent = Math.round(clampPercent(value, max));
  return (
    <div
      className={cn("progress-ring", animate && "anim-ring", className)}
      data-hue={hue}
      style={{ "--p": percent, "--size": `${size}px`, "--w": `${stroke}px` }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      {...props}
    >
      {children ? <span>{children}</span> : showValue ? <span>{percent}%</span> : null}
    </div>
  );
}

/** Former T7 CircularProgress contract. */
function CircularProgress({ value = 0, max = 100, size = 56, label, className, ...props }) {
  return <ProgressRing value={value} max={max} size={size} label={label} className={className} {...props} />;
}

/* ------------------------------------------------------------ State view */
const stateDefaults = {
  loading: { icon: null, hue: "neutral", mood: "loading" },
  empty: { icon: "folder", hue: "neutral", mood: "curious", enter: "peek" },
  error: { icon: "danger", hue: "rose", mood: "concerned", enter: "pop" },
  success: { icon: "success", hue: "green", mood: "happy", enter: "pop" },
  locked: { icon: "lock", hue: "neutral" },
};

/**
 * Loading / empty / error / success in the canvas status anatomy: visual
 * slot (APPI or a status tile) · title · short explanation · a clear way out.
 * A page-level state (404, access denied) carries the page h1 and APPI; a
 * framed slot inside a view uses a tile so one screen never shows two APPIs.
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
  framed,
  compact = false,
  size,
  appi,
  className,
  children,
}) {
  const isPage = size === "page" || TitleTag === "h1";
  const isFramed = framed ?? !isPage;
  const defaults = stateDefaults[kind] || {};
  const showAppi = !icon && defaults.mood && (appi ?? (isPage || kind === "loading"));

  return (
    <div
      className={cn("empty state-view", isFramed && "card card-dashed", compact && "state-compact", isPage && "state-page", className)}
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
    >
      {kind === "loading" && compact ? (
        <Spinner label={title || "Memuat"} />
      ) : showAppi ? (
        <div className="appi-stage"><AppiMascot mood={defaults.mood} size={kind === "loading" && !isPage ? "lg" : isPage ? "xl" : "lg"} enter={defaults.enter} /></div>
      ) : (
        <IconTile icon={icon || defaults.icon || "info"} hue={hue || defaults.hue} size={isPage ? "xl" : "lg"} shape={isPage ? undefined : "circle"} />
      )}
      {title ? <TitleTag className={isPage ? "t-title" : compact ? "t-heading" : "t-title-c"}>{title}</TitleTag> : null}
      {description ? <p className="t-body t-pretty">{description}</p> : null}
      {children}
      {action || secondaryAction ? (
        <div className="row wrap justify-center gap-3 state-actions">
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
