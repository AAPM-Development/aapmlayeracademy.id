// @ts-nocheck
import React, { useRef, useState } from "react";
import { Ic } from "@/design-system/canvas";
import { ModuleCover } from "@/components/academy/CourseElements";
import { nativeApi } from "@/api/nativeClient";
import { levelVisual } from "@/lib/academyVisuals";
import { MODULE_COVER_TEMPLATE, MODULE_HUES, MODULE_ICONS, moduleCoverAdvice, normaliseModuleVisual } from "@/lib/moduleVisual";

/**
 * "Sampul modul": the module's colour, icon, and optional banner image. Every
 * part can stay on "Ikut chapter". The previews are the two real crops learners
 * see (catalogue card and the square "continue" thumbnail), so the banner rules
 * are visible while the admin picks.
 */

const HUE_LABELS = { green: "Hijau", orange: "Oranye", blue: "Biru", violet: "Violet", teal: "Toska", amber: "Kuning", rose: "Merah muda" };
const FOCUS_OPTIONS = [{ value: "top", label: "Atas" }, { value: "center", label: "Tengah" }, { value: "bottom", label: "Bawah" }];
const COVER_TYPES = /^image\/(?:jpeg|png|webp|avif)$/;
const COVER_EXTENSIONS = /\.(?:jpe?g|png|webp|avif)$/i;
const MAX_COVER_BYTES = 20 * 1024 * 1024;

/** Arrow keys move the choice inside a radio group, as native radios do. */
function radioKeys(event, values, current, choose) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const next = values[(values.indexOf(current) + step + values.length) % values.length];
  choose(next);
  window.requestAnimationFrame(() => event.currentTarget.parentElement?.querySelector(`[data-value="${next}"]`)?.focus());
}

function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
    image.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    image.src = url;
  });
}

export default function ModuleCoverField({ value, onChange, levelNumber, moduleNumber, disabled = false }) {
  const visual = normaliseModuleVisual(value);
  const chapterHue = levelVisual(levelNumber).hue;
  const [upload, setUpload] = useState({ status: "idle", percent: 0, message: "", advice: [] });
  const controllerRef = useRef(null);
  const inputId = `module-cover-file-${moduleNumber || "new"}`;
  const update = (patch) => onChange({ ...visual, ...patch });
  const preview = { level: Number(levelNumber) || 1, moduleNumber: Number(moduleNumber) || undefined, visual };

  const hueValues = ["auto", ...MODULE_HUES];
  const iconValues = ["auto", ...MODULE_ICONS.map((option) => option.value)];

  const pick = async (file) => {
    if (!file) return;
    if (!COVER_EXTENSIONS.test(file.name || "") || (file.type && !COVER_TYPES.test(file.type))) {
      setUpload({ status: "error", percent: 0, message: "Gunakan JPG, PNG, WebP, atau AVIF untuk sampul.", advice: [] });
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setUpload({ status: "error", percent: 0, message: "Ukuran sampul maksimal 20 MB. Kompres dulu ke di bawah 1 MB.", advice: [] });
      return;
    }
    const size = await readImageSize(file);
    controllerRef.current = new AbortController();
    setUpload({ status: "loading", percent: 0, message: "Mengunggah sampul…", advice: [] });
    try {
      const result = await nativeApi.admin.media.uploadImage(file, {
        signal: controllerRef.current.signal,
        onProgress: ({ percent }) => setUpload((current) => ({ ...current, percent: Math.round(percent || 0) })),
      });
      const url = result?.media?.url;
      if (!url) throw new Error("Respons unggahan tidak lengkap.");
      update({ image: url });
      const advice = moduleCoverAdvice({ width: result.media.width || size.width, height: result.media.height || size.height, size: file.size });
      setUpload({ status: "success", percent: 100, message: advice.length ? "Sampul terpasang, dengan catatan:" : "Sampul terpasang. Simpan draf untuk menyimpannya.", advice });
    } catch (error) {
      setUpload({ status: "error", percent: 0, message: error?.name === "AbortError" ? "Unggahan dibatalkan." : (error?.message || "Sampul belum terunggah."), advice: [] });
    } finally { controllerRef.current = null; }
  };

  const loading = upload.status === "loading";
  return (
    <div className="stack gap-4">
      <div className="module-cover-previews" aria-label="Pratinjau sampul">
        <figure>
          <ModuleCover module={preview} />
          <figcaption className="t-caption t-muted">Kartu katalog</figcaption>
        </figure>
        <figure>
          <ModuleCover module={preview} />
          <figcaption className="t-caption t-muted">Baris lanjut</figcaption>
        </figure>
      </div>

      <div className="stack gap-2">
        <span className="t-support t-strong" id="module-cover-hue-label">Warna</span>
        <div className="module-swatches" role="radiogroup" aria-labelledby="module-cover-hue-label">
          {hueValues.map((hue) => {
            const checked = visual.hue === hue;
            const label = hue === "auto" ? `Ikut chapter (${HUE_LABELS[chapterHue] || chapterHue})` : HUE_LABELS[hue];
            return (
              <button key={hue} type="button" role="radio" aria-checked={checked} aria-label={label} title={label}
                tabIndex={checked ? 0 : -1} data-value={hue} disabled={disabled}
                className="module-swatch" data-hue={hue === "auto" ? undefined : hue} data-auto={hue === "auto" ? "" : undefined}
                onClick={() => update({ hue })} onKeyDown={(event) => radioKeys(event, hueValues, visual.hue, (next) => update({ hue: next }))} />
            );
          })}
        </div>
        <span className="t-caption t-muted">{visual.hue === "auto" ? `Ikut warna Chapter ${levelNumber || "—"}.` : `${HUE_LABELS[visual.hue]} — dipakai di kartu, lesson, dan kuis modul ini.`}</span>
      </div>

      <div className="stack gap-2">
        <span className="t-support t-strong" id="module-cover-icon-label">Ikon</span>
        <div className="module-icon-grid" role="radiogroup" aria-labelledby="module-cover-icon-label" data-hue={visual.hue === "auto" ? chapterHue : visual.hue}>
          {iconValues.map((icon) => {
            const checked = visual.icon === icon;
            const label = icon === "auto" ? "Ikut chapter" : MODULE_ICONS.find((option) => option.value === icon)?.label;
            return (
              <button key={icon} type="button" role="radio" aria-checked={checked} aria-label={label} title={label}
                tabIndex={checked ? 0 : -1} data-value={icon} disabled={disabled} className="module-icon-option"
                onClick={() => update({ icon })} onKeyDown={(event) => radioKeys(event, iconValues, visual.icon, (next) => update({ icon: next }))}>
                {icon === "auto" ? "Auto" : <Ic name={icon} />}
              </button>
            );
          })}
        </div>
        {visual.image ? <span className="t-caption t-muted">Ikon tidak tampil selama gambar sampul dipakai.</span> : null}
      </div>

      <div className="stack gap-2">
        <span className="t-support t-strong">Gambar banner <span className="t-muted" style={{ fontWeight: 400 }}>· opsional</span></span>
        <div className="row wrap gap-2">
          <input id={inputId} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" disabled={disabled || loading}
            onChange={(event) => { const [file] = event.target.files || []; event.target.value = ""; void pick(file); }} />
          <label htmlFor={inputId} className={`btn btn-secondary btn-sm${disabled || loading ? " is-disabled" : ""}`} aria-disabled={disabled || loading || undefined} style={{ cursor: "pointer" }}>
            <Ic name="upload" />{loading ? `Mengunggah ${upload.percent}%` : visual.image ? "Ganti gambar" : "Unggah gambar"}
          </label>
          {loading ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => controllerRef.current?.abort()}>Batal</button> : null}
          {visual.image && !loading ? <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => { update({ image: "", focus: "center" }); setUpload({ status: "idle", percent: 0, message: "", advice: [] }); }}><Ic name="trash" />Hapus gambar</button> : null}
        </div>
        {visual.image ? (
          <div className="stack gap-1">
            <span className="t-caption t-muted" id="module-cover-focus-label">Bagian yang dipertahankan saat dipotong</span>
            <div className="seg" role="radiogroup" aria-labelledby="module-cover-focus-label">
              {FOCUS_OPTIONS.map((option) => (
                <button key={option.value} type="button" role="radio" aria-checked={visual.focus === option.value} aria-pressed={visual.focus === option.value}
                  tabIndex={visual.focus === option.value ? 0 : -1} data-value={option.value} disabled={disabled}
                  onClick={() => update({ focus: option.value })}
                  onKeyDown={(event) => radioKeys(event, FOCUS_OPTIONS.map((item) => item.value), visual.focus, (next) => update({ focus: next }))}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {upload.message ? (
          <div className={`stack gap-1 t-caption ${upload.status === "error" ? "t-danger" : upload.advice.length ? "t-warning" : "t-success"}`} role={upload.status === "error" ? "alert" : "status"}>
            <span>{upload.message}</span>
            {upload.advice.length ? <ul className="stack gap-1" style={{ paddingLeft: 16, listStyle: "disc" }}>{upload.advice.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </div>
        ) : null}
      </div>

      <details className="module-cover-rules">
        <summary><Ic name="image" size="xs" />Aturan gambar sampul<Ic name="chev-down" size="xs" className="ml-auto" /></summary>
        <ul className="t-caption">
          <li><strong>{MODULE_COVER_TEMPLATE.width} × {MODULE_COVER_TEMPLATE.height} px</strong> (rasio 2:1), minimal {MODULE_COVER_TEMPLATE.minWidth} × {MODULE_COVER_TEMPLATE.minHeight} px.</li>
          <li>Objek utama di <strong>kotak tengah {MODULE_COVER_TEMPLATE.safeWidth} × {MODULE_COVER_TEMPLATE.safeHeight} px</strong>: kartu katalog memotong atas-bawah, baris lanjut memotong kiri-kanan.</li>
          <li>Tanpa teks, logo, atau watermark. Judul, nomor modul, dan chapter sudah ditulis aplikasi.</li>
          <li>Pojok kanan atas bisa tertutup label status (“Selesai”, “Lanjutkan”).</li>
          <li>Foto nyata dari kandang atau farm, terang dan tajam. Minta izin bila ada wajah orang.</li>
          <li>JPG atau WebP di bawah 1 MB; PNG untuk ilustrasi.</li>
        </ul>
        <a className="btn btn-secondary btn-sm module-cover-template" href={MODULE_COVER_TEMPLATE.templateUrl} download="template-sampul-modul-1600x800.svg">
          <Ic name="download" />Unduh template 1600 × 800
        </a>
      </details>
    </div>
  );
}
