// Client-side checks for the auth forms. The forms set noValidate, so these
// messages replace the browser's English bubbles and land on the field they
// belong to (Field error: danger border, inline message, aria-invalid). The
// rules mirror the API's (public/api/bootstrap.php) so a valid form is not
// refused for a reason the page never showed.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NEW_PASSWORD_HINT = "Minimal 8 karakter, memuat huruf dan angka.";

export function emailError(value) {
  const email = value.trim();
  if (!email) return "Isi alamat email.";
  if (!EMAIL_PATTERN.test(email)) return "Format email belum benar.";
  return "";
}

export function passwordError(value) {
  return value ? "" : "Isi kata sandi.";
}

export function newPasswordError(value) {
  if (!value) return "Isi kata sandi.";
  if (value.length < 8) return "Minimal 8 karakter.";
  if (value.length > 128) return "Maksimal 128 karakter.";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "Kata sandi harus memuat huruf dan angka.";
  return "";
}

export function confirmPasswordError(value, password) {
  if (!value) return "Ulangi kata sandi.";
  if (value !== password) return "Konfirmasi kata sandi belum sama.";
  return "";
}

/** Drop empty messages; returns null when every field passed. */
export function collectErrors(errors) {
  const failed = Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
  return Object.keys(failed).length ? failed : null;
}

/** Move focus to the first failed field, in form order (the object's key order). */
export function focusFirstError(errors) {
  const first = Object.keys(errors)[0];
  if (first) document.getElementById(first)?.focus();
}
