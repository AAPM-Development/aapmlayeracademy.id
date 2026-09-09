import React from "react";
import { PasswordInput } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
  minLength = undefined,
  required = true,
  autoFocus = false,
}) {
  return (
    <div className="relative">
      <AapmIcon name="lock" className="pointer-events-none absolute left-3 top-[calc(50%+0.875rem)] z-10 h-4 w-4 -translate-y-1/2 text-foreground/55" />
      <PasswordInput
        id={id}
        label={label}
        revealLabel="Tampilkan password"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="h-12 border-border/80 bg-surface-subtle pl-10 pr-12 shadow-none placeholder:text-muted-foreground/60 focus:bg-card"
        minLength={minLength}
        required={required}
      />
    </div>
  );
}
