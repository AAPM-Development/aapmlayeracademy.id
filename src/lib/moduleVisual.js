/**
 * Per-module cover settings: colour, icon, and banner image. Plain JS with no
 * aliases so node tests and the editor state helpers can import it.
 */

// A module may override its chapter's look (admin "Sampul modul"). Keep these
// lists in step with MODULE_VISUAL_* in public/api/bootstrap.php; the hues
// follow LEARNING_HUES in the design system.
export const MODULE_HUES = Object.freeze(["green", "orange", "blue", "violet", "teal", "amber", "rose"]);
export const MODULE_ICONS = [
  { value: "book", label: "Buku" }, { value: "egg", label: "Telur" }, { value: "feed", label: "Pakan" },
  { value: "drop", label: "Air minum" }, { value: "thermo", label: "Suhu" }, { value: "wind", label: "Ventilasi" },
  { value: "heart", label: "Kesehatan" }, { value: "shield", label: "Biosekuriti" }, { value: "scale", label: "Timbangan" },
  { value: "chart", label: "Grafik" }, { value: "trend-up", label: "Produksi naik" }, { value: "wallet", label: "Keuangan" },
  { value: "calc", label: "Kalkulator" }, { value: "target", label: "Target" }, { value: "layers", label: "Sistem" },
  { value: "bulb", label: "Ide" }, { value: "sun", label: "Pencahayaan" }, { value: "home", label: "Kandang" },
  { value: "users", label: "Tim" }, { value: "grad", label: "Kelulusan" },
];
export const MODULE_COVER_FOCUS = ["center", "top", "bottom"];
export const DEFAULT_MODULE_VISUAL = Object.freeze({ hue: "auto", icon: "auto", image: "", focus: "center" });

/** The module's own cover settings, every part filled in (accepts the stored JSON string too). */
export function normaliseModuleVisual(value) {
  let source = value;
  if (typeof source === "string") {
    try { source = source.trim() ? JSON.parse(source) : {}; } catch { source = {}; }
  }
  if (!source || typeof source !== "object") source = {};
  return {
    hue: MODULE_HUES.includes(source.hue) ? source.hue : "auto",
    icon: MODULE_ICONS.some((option) => option.value === source.icon) ? source.icon : "auto",
    image: typeof source.image === "string" ? source.image : "",
    focus: MODULE_COVER_FOCUS.includes(source.focus) ? source.focus : "center",
  };
}

/**
 * Banner template. Covers crop to about 3:1 on catalogue cards and to a square
 * in the "continue" rows, so the subject must sit in the centre box both keep.
 */
export const MODULE_COVER_TEMPLATE = Object.freeze({
  width: 1600, height: 800, minWidth: 1200, minHeight: 600,
  safeWidth: 800, safeHeight: 400, recommendedBytes: 1048576,
  templateUrl: "/assets/templates/module-cover-template.svg",
});

/** Advice (not a block) for an uploaded banner that breaks the template. */
export function moduleCoverAdvice({ width = 0, height = 0, size = 0 } = {}) {
  const advice = [];
  const t = MODULE_COVER_TEMPLATE;
  if (width && height && (width < t.minWidth || height < t.minHeight)) advice.push(`Gambar ${width} × ${height} px akan tampak buram. Gunakan minimal ${t.minWidth} × ${t.minHeight} px.`);
  if (width && height && Math.abs(width / height - 2) > 0.35) advice.push(`Rasio ${(width / height).toFixed(2)}:1 jauh dari 2:1 — sebagian besar gambar akan terpotong.`);
  if (size > t.recommendedBytes) advice.push(`Ukuran ${(size / 1048576).toFixed(1)} MB memperlambat katalog di HP. Kompres ke di bawah 1 MB (JPG/WebP).`);
  return advice;
}
