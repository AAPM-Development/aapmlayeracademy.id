import * as React from "react";
import { cn } from "@/lib/utils";
import { brandAssets } from "@/lib/brandAssets";

// Small React wrappers for repeated Redesign v2 canvas markup (academy.css).
// Pages otherwise write the canvas classes directly, as the artboards do.

/** Canvas mask icon: <Ic name="home" />. Decorative unless `label` is set. */
export function Ic({ name, size = undefined, label = undefined, className = undefined, ...props }) {
  return (
    <span
      className={cn("ic", `ic-${name}`, size && `ic-${size}`, className)}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      {...props}
    />
  );
}

const logoSources = {
  long: brandAssets.aapm.logo,
  main: brandAssets.aapm.main,
  icon: brandAssets.aapm.icon,
};

/** AAPM .academy mark as the light/dark pair the canvas uses. */
export function Logo({ variant = "long", className = undefined, style = undefined, alt = "" }) {
  const source = logoSources[variant] || logoSources.long;
  return (
    <>
      <img className={cn("logo only-light", className)} src={source.light} alt={alt} style={style} />
      <img className={cn("logo only-dark", className)} src={source.dark} alt="" aria-hidden={alt ? true : undefined} style={style} />
    </>
  );
}

/**
 * Progress bar (`.bar`). `value` 0–100. Announced as a progressbar when a
 * `label` is given; otherwise decorative.
 */
export function Bar({ value = 0, size = undefined, hue = undefined, label = undefined, now = undefined, min = 0, max = 100, animate = false, index = undefined, onTint = false, className = undefined, style = undefined }) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div
      className={cn("bar", size && `bar-${size}`, onTint && "bar-on-tint", animate && "anim-fill", className)}
      data-hue={hue}
      style={{ "--p": percent, ...(index !== undefined ? { "--i": index } : null), ...style }}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? (now ?? percent) : undefined}
      aria-valuemin={label ? min : undefined}
      aria-valuemax={label ? max : undefined}
      aria-hidden={label ? undefined : true}
    >
      {percent > 0 ? <i /> : null}
    </div>
  );
}

/** Conic progress ring (`.progress-ring`, canvas `.ring`). */
export function Ring({ value = 0, size = 44, width = undefined, hue = undefined, animate = false, children = undefined, className = undefined, style = undefined, label = undefined }) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div
      className={cn("progress-ring", animate && "anim-ring", className)}
      data-hue={hue}
      style={{ "--p": percent, "--size": `${size}px`, ...(width ? { "--w": `${width}px` } : null), ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span>{children ?? `${percent}%`}</span>
    </div>
  );
}

/** Egg node: every lesson on the path is an egg. state: done | current | gold | hue. */
export function Egg({ state = undefined, size = undefined, className = undefined, children = undefined, ...props }) {
  return (
    <span className={cn("egg", size && `egg-${size}`, state && `is-${state}`, className)} {...props}>
      {state === "done" && children === undefined ? <Ic name="check" /> : children}
    </span>
  );
}
