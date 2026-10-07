import React from "react";
import { Field, PasswordInput } from "@/components/primitives";

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
  hint,
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <PasswordInput
        leadingIcon="lock"
        revealLabel="Tampilkan kata sandi"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        minLength={minLength}
        required={required}
      />
    </Field>
  );
}
