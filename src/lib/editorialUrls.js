function decodedInternalPath(value) {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded;
}

export function safeInternalPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const decoded = decodedInternalPath(path);
  if (
    !decoded ||
    decoded.includes("\\") ||
    /[\x00-\x1F\x7F]/.test(decoded) ||
    /(?:^|\/)\.\.?(?:$|\/)/.test(decoded)
  ) {
    return null;
  }
  return path;
}

export function safeHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function safeEditorialLink(value) {
  return safeInternalPath(value) || safeHttpsUrl(value);
}

export function safeEditorialMediaPath(value) {
  const path = safeInternalPath(value);
  return path && /^\/(?:assets|media|uploads)(?:\/|$)/.test(path) ? path : null;
}

export function safeEditorialImage(value) {
  const safe = safeEditorialMediaPath(value) || safeHttpsUrl(value);
  if (!safe) return null;
  const pathname = new URL(
    safe,
    typeof window === "undefined" ? "https://academy.invalid" : window.location.origin,
  ).pathname;
  return /\.(?:jpe?g|png|gif|webp|avif)$/i.test(pathname) ? safe : null;
}
