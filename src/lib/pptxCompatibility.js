import JSZip from "jszip";

/**
 * PowerPoint writes pasted SVG artwork as an `asvg:svgBlip` nested inside
 * `a:blip`. The learner renderer resolves image relationships from the
 * standard direct `r:embed` attribute, so the nested form otherwise produces
 * an empty relationship target and only that slide fails to render.
 *
 * Keep this compatibility pass deliberately narrow: ordinary PNG/JPG/GIF
 * relationships are left byte-for-byte alone, and no media is decoded or
 * rewritten. This keeps 1–20 MB images and the 50 MB deck contract intact.
 */
const SVG_BLIP_PATTERN = /<a:blip\b([^>]*)>\s*<a:extLst\b[\s\S]*?<(?:(?:[A-Za-z_][\w.-]*):)?svgBlip\b[^>]*?\br:embed\s*=\s*(["'])([^"']+)\2[^>]*\/?\s*>[\s\S]*?<\/a:extLst>\s*<\/a:blip\s*>/gi;

function normaliseSvgBlipMarkup(xml) {
  let changed = false;
  const normalised = xml.replace(SVG_BLIP_PATTERN, (_match, openingAttributes, _quote, relationId) => {
    changed = true;
    const safeAttributes = String(openingAttributes || "").replace(/\s+r:embed\s*=\s*(["'])[^"']+\1/gi, "");
    return `<a:blip${safeAttributes} r:embed="${relationId}"/>`;
  });

  return changed ? normalised : xml;
}

/**
 * Normalise PPTX XML only when the installed viewer needs it. Any malformed
 * or unexpectedly unsupported archive is returned unchanged so the viewer's
 * normal diagnostic path remains authoritative.
 */
export async function normalisePptxForViewer(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 1) return buffer;

  try {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: false, createFolders: false });
    const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
    let changed = false;

    for (const name of slideNames) {
      const file = zip.file(name);
      if (!file) continue;
      const xml = await file.async("string");
      const normalised = normaliseSvgBlipMarkup(xml);
      if (normalised === xml) continue;
      zip.file(name, normalised);
      changed = true;
    }

    if (!changed) return buffer;
    return await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      streamFiles: false,
    });
  } catch {
    return buffer;
  }
}

export { normaliseSvgBlipMarkup };
