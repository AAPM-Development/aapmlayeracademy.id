import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconButton } from "@/components/ui/icon-button";
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
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="aapm-field relative rounded-xl">
        <AapmIcon name="lock" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="h-12 rounded-xl border-border/80 bg-surface-subtle pl-10 pr-11 shadow-none placeholder:text-muted-foreground/60 focus:bg-card"
          minLength={minLength}
          required={required}
        />
        <IconButton
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => setVisible((current) => !current)}
          label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
        >
          <AapmIcon name={visible ? "eyeOff" : "eye"} className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}
