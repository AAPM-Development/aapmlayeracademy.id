import React from "react";
import { Field, PasswordInput } from "@/components/primitives";
import { PasswordRequirements } from "@/components/AuthLayout";
import { Ic } from "@/design-system/canvas";

// No dotted default placeholder: eight dots read as a password already typed.
// `requirements` swaps the static hint for the canvas live checklist.
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = undefined,
  minLength = undefined,
  required = true,
  autoFocus = false,
  hint = undefined,
  error = undefined,
  invalid = false,
  labelAction = undefined,
  requirements = false,
}) {
  const input = (props = {}) => (
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
      {...props}
    />
  );

  if (!requirements) {
    return <Field id={id} label={label} hint={hint} error={error} labelAction={labelAction}>{input()}</Field>;
  }

  const listId = `${id}-requirements`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {input({ id, "aria-describedby": error ? `${listId} ${errorId}` : listId, "aria-invalid": error || invalid ? true : undefined })}
      <PasswordRequirements id={listId} value={value} />
      {error ? <p id={errorId} className="hint hint-error" role="alert"><Ic name="x-circle" size="sm" />{error}</p> : null}
    </div>
  );
}
