function safeInternalVideoPath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  let decoded;
  try { decoded = decodeURIComponent(path.split(/[?#]/)[0]); } catch { return null; }
  if (/[\\\u0000-\u001f]/.test(decoded) || decoded.includes("//") || /(?:^|\/)\.\.?($|\/)/.test(decoded)) return null;
  if (!/^\/(?:assets|media|uploads)(?:\/|$)/.test(path)) return null;
  return /\.(mp4|webm|ogg|m4v)(?:[?#]|$)/i.test(path) ? path : null;
}

export function trustedVideoSource(value) {
  const internalPath = safeInternalVideoPath(value);
  if (internalPath) return { kind: "file", src: internalPath };

  try {
    const source = new URL(value);
    if (source.protocol !== "https:" || !source.hostname || source.username || source.password) {
      return null;
    }
    const hostname = source.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "youtu.be") {
      const id = source.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{6,}$/.test(id)
        ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` }
        : null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtube-nocookie.com") {
      const id =
        source.searchParams.get("v") ||
        source.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/)?.[1];
      return id && /^[A-Za-z0-9_-]{6,}$/.test(id)
        ? { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` }
        : null;
    }

    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) {
      // Unlisted videos carry their privacy hash as /ID/HASH or ?h=HASH.
      const match = source.pathname.match(/\/(\d+)(?:\/([0-9a-f]{6,}))?(?:\/|$)/i);
      const hash = match?.[2] || source.searchParams.get("h");
      return match?.[1] ? { kind: "embed", provider: "Vimeo", src: `https://player.vimeo.com/video/${match[1]}${hash && /^[0-9a-f]+$/i.test(hash) ? `?h=${hash}` : ""}` } : null;
    }

    if (hostname === "drive.google.com") {
      const id = source.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,})(?:\/(?:view|preview))?\/?$/)?.[1] || (/^\/(?:open|uc)$/.test(source.pathname) ? source.searchParams.get("id") : null);
      return id && /^[A-Za-z0-9_-]{10,}$/.test(id) ? { kind: "embed", provider: "Google Drive", src: `https://drive.google.com/file/d/${id}/preview` } : null;
    }

    if (hostname === "loom.com") {
      const id = source.pathname.match(/^\/(?:share|embed)\/([0-9a-f]{32})\/?$/i)?.[1];
      return id ? { kind: "embed", provider: "Loom", src: `https://www.loom.com/embed/${id}` } : null;
    }

    // Dailymotion requires a Player ID. A share link alone opens at the provider;
    // an official iframe URL carries both IDs and can be embedded safely.
    if (hostname === "geo.dailymotion.com") {
      const player = source.pathname.match(/^\/player\/([A-Za-z0-9]+)\.html$/)?.[1];
      const video = source.searchParams.get("video");
      return player && video && /^[A-Za-z0-9]+$/.test(video) ? { kind: "embed", provider: "Dailymotion", src: `https://geo.dailymotion.com/player/${player}.html?video=${video}` } : null;
    }

    if (hostname === "dailymotion.com" || hostname === "dai.ly") {
      const id = hostname === "dai.ly" ? source.pathname.split("/").filter(Boolean)[0] : source.pathname.match(/^\/video\/([A-Za-z0-9]+)/)?.[1];
      return id && /^[A-Za-z0-9]+$/.test(id) ? { kind: "link", provider: "Dailymotion", src: `https://www.dailymotion.com/video/${id}` } : null;
    }

    if (/\.(mp4|webm|ogg|m4v)$/i.test(source.pathname)) {
      return { kind: "file", src: source.toString() };
    }
  } catch {
    return null;
  }

  return null;
}
