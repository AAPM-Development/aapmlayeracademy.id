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

/**
 * Copy rich content: `html` for editors that read formatting, `text` for
 * everywhere else. Falls back to plain text when the browser cannot write
 * HTML to the clipboard.
 */
export async function copyRich({ html = "", text = "" } = {}) {
  try {
    if (html && window.isSecureContext && typeof window.ClipboardItem === "function" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new window.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
      return true;
    }
  } catch {
    // Fall through to plain text.
  }
  return copyText(text);
}
