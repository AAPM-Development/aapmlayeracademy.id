/**
 * Copy text to the clipboard. Uses the async Clipboard API in a secure
 * context and falls back to a hidden textarea elsewhere (older WebViews),
 * returning focus to where it was. Resolves to whether the copy happened.
 */
export async function copyText(text) {
  const value = String(text ?? "");
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  const previousFocus = document.activeElement;
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.inset = "0 auto auto 0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  } finally {
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
}
