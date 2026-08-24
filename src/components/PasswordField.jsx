import React, { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
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
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
