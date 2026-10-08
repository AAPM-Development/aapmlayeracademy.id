import React from "react";
import { Field, PasswordInput } from "@/components/primitives";

// No dotted default placeholder: eight dots read as a password already typed.
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength = undefined,
  required = true,
  autoFocus = false,
  hint,
  error,
  invalid = false,
  labelAction,
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} labelAction={labelAction}>
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
        aria-invalid={invalid || undefined}
      />
    </Field>
  );
}
