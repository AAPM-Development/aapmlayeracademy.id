// @ts-nocheck
import React from "react";
import { createPortal } from "react-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import RichTextEditor from "@/components/admin/RichTextEditor";
import UploadProgress from "@/components/admin/UploadProgress";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import { EditorialContent } from "@/components/academy/EditorialContent";
import { EditorialOutlineList } from "@/components/admin/EditorOutline";
import EditorialPresentation from "@/components/academy/EditorialPresentation";
import { nativeApi } from "@/api/nativeClient";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  IconButton,
  IconTile,
  Input,
  Label,
  OverflowMenu,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StateView,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/primitives";
import { cn } from "@/lib/utils";
import { safeEditorialImage } from "@/lib/editorialUrls";
import { EDITORIAL_PRESENTATION_MAX_BYTES } from "@/lib/editorialLimits";
import {
  EDITORIAL_PRESENTATION_ACCEPT,
  editorialPresentationMeta,
  getEditorialPresentationFormat,
  getEditorialPresentationFormatFromName,
} from "@/lib/editorialPresentation";
import {
  EDITORIAL_TEXT_LIMIT,
  createEditorialBlock,
  createEditorialDocument,
  createEditorialSlide,
  editorialBlockAnchorId,
  editorialTextLength,
  editorialBlockLibrary,
  editorialComposerBlocks,
  getEditorialQualitySignals,
  parseEditorialDocument,
} from "@/lib/editorialDocument";

const blockMeta = Object.fromEntries(editorialBlockLibrary.map((item) => [item.type, item]));
/* Editor content types are domain data, but their controls still use the
 * canonical T7 icon registry. Keeping this map here prevents authored Solar
 * names from creating a second visual language inside the composer. */
const editorIconByType = Object.freeze({
  richText: "file",
  heading: "type",
  table: "table",
  image: "image",
  slides: "image",
  video: "preview",
  link: "arrowRight",
  cta: "arrowRight",
  callout: "info",
  divider: "clear",
});

const editorIcon = (type) => editorIconByType[type] || "file";
const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_PRESENTATION_UPLOAD_BYTES = EDITORIAL_PRESENTATION_MAX_BYTES;
const imageExtensions = /\.(?:jpe?g|png|gif|webp|avif)$/i;
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

const contentBlockAnchorId = (blockId) => "editor-" + editorialBlockAnchorId(blockId);

function Field({ label, children, hint = "", id, required = false, error = "" }) {
  const descriptionId = id && (hint || error) ? `${id}-description` : undefined;
  return (
    <div className="aapm-field">
      <Label htmlFor={id} required={required}>{label}</Label>
      {children}
      {(hint || error) ? <p id={descriptionId} className={error ? "aapm-field-error" : "aapm-field-hint"} role={error ? "alert" : undefined}>{error || hint}</p> : null}
    </div>
  );
}

function moveInList(items, sourceIndex, destinationIndex) {
  if (destinationIndex < 0 || destinationIndex >= items.length || sourceIndex === destinationIndex) return items;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(destinationIndex, 0, moved);
  return next;
}

function readableBytes(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function imageUrlIssue(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  return safeEditorialImage(source)
    ? ""
    : "Gunakan URL HTTPS gambar atau path gambar pada /assets/, /media/, atau /uploads/.";
}

function imageFileIssue(file) {
  if (!file) return "";
  if (!imageExtensions.test(file.name || "") || (file.type && !imageMimeTypes.has(file.type))) {
    return "Pilih gambar JPG, PNG, GIF, WebP, atau AVIF.";
  }
  if (file.size < 1 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return `Ukuran gambar maksimal ${readableBytes(MAX_IMAGE_UPLOAD_BYTES)}.`;
  }
  return "";
}

async function uploadEditorialImage(file, options) {
  const issue = imageFileIssue(file);
  if (issue) throw new Error(issue);
  const result = await nativeApi.admin.media.uploadImage(file, options);
  const url = result?.media?.url;
  if (!url) throw new Error("Respons unggahan gambar tidak lengkap.");
  return url;
}

const imagePreviewRatio = {
  natural: "",
  wide: "aspect-video",
  standard: "aspect-[4/3]",
  square: "aspect-square",
};

const imageAlignmentClass = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

const imagePositionClass = {
  top: "object-top",
  center: "object-center",
  bottom: "object-bottom",
};

const ctaAlignmentClass = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

function useImageDimensions(src) {
  const [dimensions, setDimensions] = React.useState(null);

  React.useEffect(() => {
    if (!src || imageUrlIssue(src)) {
      setDimensions(null);
      return undefined;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      if (active) setDimensions(null);
    };
    image.src = src;
    return () => { active = false; };
  }, [src]);

  return dimensions;
}

const ALIGN_OPTIONS = [
  { value: "left", label: "Kiri", icon: "imageAlignLeft" },
  { value: "center", label: "Tengah", icon: "imageAlignCenter" },
  { value: "right", label: "Kanan", icon: "imageAlignRight" },
];

/** Small mutually exclusive choice (segmented). Icons are labelled for AT. */
function OptionGroup({ id, label, value, options, onChange }) {
  return (
    <div className="aapm-field">
      <span className="aapm-label" id={`${id}-label`}>{label}</span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="aapm-segmented aapm-option-group">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-pressed={value === option.value}
            aria-label={option.icon ? option.label : undefined}
            title={option.label}
            className="aapm-tabs-trigger"
            onClick={() => onChange(option.value)}
          >
            {option.icon ? <AapmIcon name={option.icon} /> : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlignmentField({ id, value = "left", onChange, label = "Perataan" }) {
  return <OptionGroup id={id} label={label} value={value || "left"} options={ALIGN_OPTIONS} onChange={onChange} />;
}

/** Colour accent as swatches; options carry the learning hue they map to. */
function ToneField({ id, label = "Warna", value, options, onChange }) {
  const active = options.find((option) => option.value === value);
  return (
    <div className="aapm-field">
      <span className="aapm-label" id={`${id}-label`}>{label}{active ? <span className="aapm-meta"> · {active.label}</span> : null}</span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="aapm-hue-select">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.label}
            data-hue={option.hue}
            className="aapm-hue-select__swatch"
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

const TONE_OPTIONS = [
  { value: "neutral", label: "Netral", hue: "neutral" },
  { value: "green", label: "Hijau", hue: "green" },
  { value: "orange", label: "Oranye", hue: "orange" },
  { value: "blue", label: "Biru", hue: "blue" },
  { value: "violet", label: "Violet", hue: "violet" },
];
const CALLOUT_TONES = [
  { value: "info", label: "Info", hue: "green" },
  { value: "practice", label: "Praktik", hue: "orange" },
  { value: "warning", label: "Peringatan", hue: "amber" },
  { value: "blue", label: "Informasi", hue: "blue" },
  { value: "violet", label: "Insight", hue: "violet" },
  { value: "neutral", label: "Netral", hue: "neutral" },
];
const TARGET_OPTIONS = [
  { value: "auto", label: "Otomatis" },
  { value: "same", label: "Tab ini" },
  { value: "new", label: "Tab baru" },
];
const WIDTH_OPTIONS = [
  { value: "standard", label: "Standar" },
  { value: "wide", label: "Lebar" },
];

function SourceImagePreview({ src, alt, ratio = "wide", width = "standard", align = "left", position = "center" }) {
  const [failed, setFailed] = React.useState(false);
  const issue = imageUrlIssue(src);

  React.useEffect(() => setFailed(false), [src]);

  if (!src || issue) return null;
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-surface-subtle", width === "wide" ? "max-w-none" : "max-w-3xl")}>
      <div className={cn("bg-muted", imagePreviewRatio[ratio] || "")}>
        {failed ? (
          <p className="p-3 text-xs leading-5 text-danger" role="alert">Pratinjau tidak dapat dimuat. Periksa URL atau unggah gambar.</p>
        ) : (
          <img src={src} alt={alt || ""} className={cn("block max-w-full", imageAlignmentClass[align] || imageAlignmentClass.left, ratio === "natural" ? "h-auto w-auto object-contain" : "h-full w-full object-cover", imagePositionClass[position] || imagePositionClass.center)} onError={() => setFailed(true)} />
        )}
      </div>
    </div>
  );
}

function ImageSourceField({ id, value, onValueChange, alt = "", label = "Gambar / GIF", hint, previewRatio = "wide", previewWidth = "standard", previewAlign = "left", previewPosition = "center" }) {
  const [uploadState, setUploadState] = React.useState({ status: "idle", message: "", progress: null });
  const uploadControllerRef = React.useRef(null);
  const sourceIssue = imageUrlIssue(value);
  const uploadId = `${id}-upload`;

  React.useEffect(() => () => uploadControllerRef.current?.abort(), []);

  const uploadImage = async (file) => {
    const issue = imageFileIssue(file);
    if (issue) {
      setUploadState({ status: "error", message: issue, progress: null });
      return;
    }
    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setUploadState({ status: "loading", message: "Mengunggah dan memeriksa gambar…", progress: 0 });
    try {
      const url = await uploadEditorialImage(file, {
        signal: controller.signal,
        onProgress: ({ percent }) => setUploadState((current) => current.status === "loading" ? { ...current, progress: percent } : current),
      });
      onValueChange(url);
      setUploadState({ status: "success", message: "Gambar siap dipakai dalam materi.", progress: 100 });
    } catch (error) {
      setUploadState({
        status: error?.name === "AbortError" ? "cancelled" : "error",
        message: error?.name === "AbortError" ? "Unggahan dibatalkan." : error?.message || "Gambar tidak dapat diunggah.",
        progress: null,
      });
    } finally {
      if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-2.5">
      <Field id={id} label={label} hint={sourceIssue || hint || "Unggah file terkelola atau gunakan URL HTTPS gambar yang aman."} error={sourceIssue}>
        <Input
          id={id}
          type="text"
          inputMode="url"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={Boolean(sourceIssue)}
          aria-describedby={`${id}-description`}
          placeholder="https://cdn.example.com/ilustrasi.webp"
          value={value || ""}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={uploadId}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif,.jpg,.jpeg,.png,.gif,.webp,.avif"
          className="sr-only"
          disabled={uploadState.status === "loading"}
          onChange={(event) => {
            const [file] = event.target.files || [];
            event.target.value = "";
            if (file) void uploadImage(file);
          }}
        />
        <Button asChild type="button" size="sm" variant="outline" disabled={uploadState.status === "loading"} aria-busy={uploadState.status === "loading"}>
          <label htmlFor={uploadId} className="cursor-pointer"><AapmIcon name={uploadState.status === "loading" ? "loading" : "fileCheck"} className={cn("h-3.5 w-3.5", uploadState.status === "loading" && "animate-spin")} />{uploadState.status === "loading" ? "Mengunggah…" : "Unggah gambar"}</label>
        </Button>
        <span className="text-[11px] leading-5 text-muted-foreground">Maks. 20 MB · JPG, PNG, GIF, WebP, AVIF</span>
      </div>
      {uploadState.status === "loading" && <UploadProgress progress={uploadState.progress} label={uploadState.message} onCancel={() => uploadControllerRef.current?.abort()} />}
      {uploadState.status !== "idle" && uploadState.status !== "loading" && <p className={cn("inline-flex items-center gap-1.5 text-[11px] leading-5", uploadState.status === "error" ? "text-danger" : uploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={uploadState.status === "error" ? "alert" : "status"} aria-live="polite"><AapmIcon name={uploadState.status === "success" ? "approve" : "info"} className="h-3.5 w-3.5 shrink-0" />{uploadState.message}</p>}
      <SourceImagePreview src={value} alt={alt} ratio={previewRatio} width={previewWidth} align={previewAlign} position={previewPosition} />
    </div>
  );
}

function ImageProportionHint({ src, ratio }) {
  const dimensions = useImageDimensions(src);
  if (!src || !dimensions) return null;
  const isPortrait = dimensions.height > dimensions.width * 1.2;
  const size = `${dimensions.width.toLocaleString("id-ID")} × ${dimensions.height.toLocaleString("id-ID")} px`;
  const message = ratio === "natural" && isPortrait
    ? "Gambar portrait akan tampil tinggi pada learner. Pertimbangkan 4:3 atau 16:9 jika gambar berfungsi sebagai sela konten."
    : ratio === "natural"
      ? "Rasio asli dipertahankan di learner."
      : "Gambar akan di-crop sesuai rasio pilihan; pastikan subjek utama berada di tengah frame.";
  return <p className={cn("aapm-token-alert rounded-xl border px-3 py-2 text-[11px] leading-5", ratio === "natural" && isPortrait ? "border-tint-orange-border bg-tint-orange text-tint-orange-foreground" : "border-border bg-surface-subtle text-muted-foreground")}><span className="font-semibold text-foreground">{size}</span> · {message}</p>;
}

function DecorativeImageControl({ id, decorative, onChange }) {
  return (
    <label htmlFor={id} className="aapm-choice-row aapm-inspector-check">
      <Checkbox id={id} checked={Boolean(decorative)} onCheckedChange={(checked) => onChange(Boolean(checked))} />
      <span className="min-w-0">
        <span className="aapm-text-label block">Gambar dekoratif</span>
        <span className="aapm-field-hint block">Tidak membawa informasi, jadi alt text tidak diperlukan.</span>
      </span>
    </label>
  );
}

function TableBlockFields({ block, onChange }) {
  const columns = Array.isArray(block.columns) ? block.columns : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const updateColumn = (index, value) => onChange({ columns: columns.map((column, currentIndex) => currentIndex === index ? value : column) });
  const updateCell = (rowIndex, columnIndex, value) => onChange({ rows: rows.map((row, currentRow) => currentRow === rowIndex ? row.map((cell, currentColumn) => currentColumn === columnIndex ? value : cell) : row) });
  const addColumn = () => {
    if (columns.length >= 8) return;
    onChange({ columns: [...columns, ""], rows: rows.map((row) => [...row, ""]) });
  };
  const addRow = () => {
    if (rows.length >= 20) return;
    onChange({ rows: [...rows, columns.map(() => "")] });
  };

  return (
    <div className="space-y-3">
      <Field id={`${block.id}-table-title`} label="Judul tabel (opsional)">
        <Input id={`${block.id}-table-title`} value={block.title || ""} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="Judul tabel" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
         <div className="text-xs font-semibold">Isi tabel</div>
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={columns.length >= 8} onClick={addColumn}><AapmIcon name="add" className="h-3.5 w-3.5" />Kolom</Button><Button type="button" size="sm" variant="outline" disabled={rows.length >= 20} onClick={addRow}><AapmIcon name="add" className="h-3.5 w-3.5" />Baris</Button></div>
      </div>
      <Table className="aapm-editorial-table aapm-editorial-table--editor min-w-full text-xs" aria-label={block.title ? `Editor tabel ${block.title}` : "Editor tabel materi"}>
        <TableHeader><TableRow>{columns.map((column, index) => <TableHead key={`column-${index}`} className="min-w-36 align-top"><label className="sr-only" htmlFor={`${block.id}-column-${index}`}>Nama kolom {index + 1}</label><Input id={`${block.id}-column-${index}`} value={column} maxLength={160} onChange={(event) => updateColumn(index, event.target.value)} className="aapm-token-control h-8 text-xs font-semibold" /></TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row, rowIndex) => <TableRow key={`row-${rowIndex}`} className="align-top">{columns.map((_, columnIndex) => <TableCell key={`cell-${rowIndex}-${columnIndex}`} className="min-w-36 align-top"><label className="sr-only" htmlFor={`${block.id}-cell-${rowIndex}-${columnIndex}`}>Baris {rowIndex + 1}, kolom {columnIndex + 1}</label><Textarea id={`${block.id}-cell-${rowIndex}-${columnIndex}`} rows={2} maxLength={3000} value={row?.[columnIndex] || ""} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} className="aapm-token-control min-h-16 text-xs" /></TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
  );
}

function SlidesBlockFields({ block, onChange }) {
  const source = getEditorialPresentationFormat(block.presentationFormat || block.source) || "manual";
  const slides = Array.isArray(block.slides) ? block.slides : [];
  const [uploadState, setUploadState] = React.useState({ status: "idle", message: "", progress: null });
  const uploadControllerRef = React.useRef(null);
  const [pendingPresentation, setPendingPresentation] = React.useState(null);
  const [pendingAction, setPendingAction] = React.useState(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const presentationInputId = `${block.id}-presentation-upload`;
  const updateSlide = (index, patch) => onChange({ slides: slides.map((slide, currentIndex) => currentIndex === index ? { ...slide, ...patch } : slide) });

  React.useEffect(() => () => uploadControllerRef.current?.abort(), []);

  const uploadPresentationFile = async (file) => {
    if (!file) return;
    const format = getEditorialPresentationFormatFromName(file.name);
    if (!format) {
      setUploadState({ status: "error", message: "Gunakan .pptx, .ppt, .key (Keynote), .odp, atau .pdf.", progress: null });
      return;
    }
    if (file.size < 1 || file.size > MAX_PRESENTATION_UPLOAD_BYTES) {
      setUploadState({ status: "error", message: `Ukuran file maksimal ${readableBytes(MAX_PRESENTATION_UPLOAD_BYTES)}.`, progress: null });
      return;
    }
    const meta = editorialPresentationMeta(format);
    uploadControllerRef.current?.abort();
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setUploadState({ status: "loading", message: `Memeriksa dan mengunggah ${meta.shortLabel}…`, progress: 0 });
    try {
      const result = await nativeApi.admin.media.uploadPresentation(file, {
        signal: controller.signal,
        onProgress: ({ percent }) => setUploadState((current) => current.status === "loading" ? { ...current, progress: percent } : current),
      });
      const presentation = result?.presentation;
      if (!presentation?.url || !presentation?.format) throw new Error("Respons unggahan presentasi tidak lengkap.");
      const uploadedFormat = getEditorialPresentationFormat(presentation.format) || format;
      onChange({
        source: uploadedFormat,
        presentationFormat: uploadedFormat,
        presentationUrl: presentation.url,
        presentationName: presentation.name || file.name,
        presentationMime: presentation.mime || file.type || "",
        presentationSize: Number(presentation.size) || file.size,
        slideCount: Number(presentation.slideCount) || 0,
        ...(uploadedFormat === "pptx" ? { pptxUrl: presentation.url, pptxName: presentation.name || file.name } : { pptxUrl: "", pptxName: "" }),
        slides: [],
      });
      setPendingPresentation(null);
      setUploadState({ status: "success", message: `${meta.shortLabel} siap.`, progress: 100 });
    } catch (error) {
      setUploadState({
        status: error?.name === "AbortError" ? "cancelled" : "error",
        message: error?.name === "AbortError" ? "Unggahan dibatalkan." : error?.message || `${meta.shortLabel} tidak dapat diunggah.`,
        progress: null,
      });
    } finally {
      if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
    }
  };

  const choosePresentation = (file) => {
    const hasManualContent = source === "manual" && slides.some((slide) => slide.title?.trim() || slide.content?.trim() || slide.src?.trim());
    if (hasManualContent) {
      setPendingPresentation(file);
      setUploadState({ status: "idle", message: "", progress: null });
      return;
    }
    void uploadPresentationFile(file);
  };

  const switchToManual = () => {
    if (source !== "manual") {
      setPendingAction({ type: "switch-to-manual" });
      return;
    }
    onChange({ source: "manual", presentationFormat: "", presentationUrl: "", presentationName: "", presentationMime: "", presentationSize: 0, pptxUrl: "", pptxName: "", slideCount: 0, slides: slides.length ? slides : [createEditorialSlide(1)] });
  };

  const confirmAction = () => {
    if (pendingAction?.type === "delete-slide") onChange({ slides: slides.filter((_, currentIndex) => currentIndex !== pendingAction.index) });
    if (pendingAction?.type === "switch-to-manual") onChange({ source: "manual", presentationFormat: "", presentationUrl: "", presentationName: "", presentationMime: "", presentationSize: 0, pptxUrl: "", pptxName: "", slideCount: 0, slides: slides.length ? slides : [createEditorialSlide(1)] });
    setPendingAction(null);
  };

  const pendingTitle = pendingAction?.type === "delete-slide" ? "Hapus slide?" : "Kembali ke slide manual?";
  const pendingDescription = pendingAction?.type === "delete-slide" ? `Slide ${(pendingAction?.index ?? 0) + 1} akan dihapus dari rangkaian ini.` : "Referensi file presentasi akan dilepas dari elemen ini. File di server tidak dihapus.";

  return (
    <div className="aapm-editor-slide-fields aapm-editor-media-fields space-y-3">
      <div className="aapm-editor-media-row grid items-end gap-3">
        <Field id={`${block.id}-slides-title`} label="Judul rangkaian slide (opsional)"><Input id={`${block.id}-slides-title`} value={block.title || ""} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="Judul rangkaian slide" /></Field>
      </div>
      <div className="aapm-editor-slide-assets">
      <div className="aapm-editor-slide-source rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-3"><div className="aapm-editor-slide-source__inner flex min-w-0 items-center gap-3"><div className="aapm-editor-slide-source__meta flex min-w-0 flex-1 items-baseline gap-2"><div className="shrink-0 text-xs font-semibold">Sumber slide</div><div className="min-w-0 truncate text-[11px] leading-5 text-muted-foreground">PPTX/PPT, Keynote, ODP, atau PDF · maksimal 50 MB</div></div><div className="flex shrink-0 items-center gap-2"><Button type="button" size="sm" variant={source === "manual" ? "default" : "outline"} onClick={switchToManual}><AapmIcon name="edit" className="h-3.5 w-3.5" />Manual</Button><input id={presentationInputId} type="file" accept={EDITORIAL_PRESENTATION_ACCEPT} className="sr-only" disabled={uploadState.status === "loading"} onChange={(event) => { const [file] = event.target.files || []; event.target.value = ""; if (file) choosePresentation(file); }} /><Button asChild type="button" size="sm" variant={source !== "manual" ? "default" : "outline"} disabled={uploadState.status === "loading"} aria-busy={uploadState.status === "loading"}><label htmlFor={presentationInputId} className="cursor-pointer"><AapmIcon name={uploadState.status === "loading" ? "loading" : "fileCheck"} className={cn("h-3.5 w-3.5", uploadState.status === "loading" && "animate-spin")} />{uploadState.status === "loading" ? "Mengunggah…" : source !== "manual" ? `Ganti ${editorialPresentationMeta(source).shortLabel}` : "Unggah file"}</label></Button></div></div></div>
      {(pendingPresentation || uploadState.status !== "idle") && <div className="aapm-editor-slide-statuses">
        {pendingPresentation && <div className="flex flex-col gap-3 rounded-xl border border-brand-orange/25 bg-brand-orange/5 p-3 sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite"><div className="min-w-0"><p className="text-xs font-semibold">Siap mengganti sumber slide</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{pendingPresentation.name}</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={uploadState.status === "loading"} onClick={() => void uploadPresentationFile(pendingPresentation)}><AapmIcon name={uploadState.status === "loading" ? "loading" : "fileCheck"} className={cn("h-3.5 w-3.5", uploadState.status === "loading" && "animate-spin")} />{uploadState.status === "loading" ? "Mengunggah…" : "Gunakan file"}</Button><Button type="button" size="sm" variant="outline" disabled={uploadState.status === "loading"} onClick={() => setPendingPresentation(null)}>Batal</Button></div></div>}
        {uploadState.status === "loading" && <UploadProgress progress={uploadState.progress} label={uploadState.message} onCancel={() => uploadControllerRef.current?.abort()} />}
        {uploadState.status !== "idle" && uploadState.status !== "loading" && <p className={cn("inline-flex items-center gap-1.5 text-[11px] leading-4", uploadState.status === "error" ? "text-danger" : uploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={uploadState.status === "error" ? "alert" : "status"} aria-live="polite"><AapmIcon name={uploadState.status === "success" ? "approve" : "info"} className="h-3.5 w-3.5 shrink-0" />{uploadState.message}</p>}
      </div>}
      {source !== "manual" ? <div className="aapm-editor-presentation-file aapm-editor-slide-presentation-file rounded-xl border border-border bg-background p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><AapmIcon name="fileCheck" className="h-4 w-4 shrink-0 text-brand-orange" /><div className="min-w-0"><div className="truncate text-sm font-semibold">{block.presentationName || block.pptxName || "File presentasi"}</div><div className="text-[11px] text-muted-foreground">{source === "pptx" && block.slideCount ? `${block.slideCount} slide · ` : ""}{editorialPresentationMeta(source).label}</div></div></div><div className="flex flex-wrap items-center justify-end gap-2"><Badge variant="soft" className="bg-tint-green text-brand-green">{editorialPresentationMeta(source).shortLabel}</Badge><Button type="button" size="sm" variant="outline" disabled={!block.presentationUrl && !block.pptxUrl} onClick={() => setPreviewOpen((open) => !open)}><AapmIcon name={previewOpen ? "chevronUp" : "eye"} className="h-3.5 w-3.5" />{previewOpen ? "Tutup" : source === "ppt" || source === "key" || source === "odp" ? "Lihat file" : "Pratinjau"}</Button></div></div>{previewOpen && (block.presentationUrl || block.pptxUrl) && <div className="mt-3 border-t border-border pt-3"><EditorialPresentation src={block.presentationUrl || block.pptxUrl} format={source} title={block.title || block.presentationName || block.pptxName || "Presentasi"} name={block.presentationName || block.pptxName} declaredSlideCount={block.slideCount} compact /></div>}</div> : <>
        <div className="aapm-editor-slide-manual-controls flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle p-3"><div className="text-xs font-semibold">Rangkaian slide manual</div><Button type="button" size="sm" variant="outline" disabled={slides.length >= 12} onClick={() => onChange({ slides: [...slides, createEditorialSlide(slides.length + 1)] })}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah slide</Button></div>
        <div className="aapm-editor-slide-manual-list space-y-3">{slides.map((slide, index) => <article key={slide.id} className="rounded-xl border border-border bg-background p-3 shadow-sm sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><span className="text-xs font-semibold">Slide {index + 1} dari {slides.length}</span><div className="flex flex-wrap gap-1.5"><IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Naikkan slide ${index + 1}`} tooltip="Naikkan slide satu posisi" disabled={index === 0} onClick={() => onChange({ slides: moveInList(slides, index, index - 1) })}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Turunkan slide ${index + 1}`} tooltip="Turunkan slide satu posisi" disabled={index === slides.length - 1} onClick={() => onChange({ slides: moveInList(slides, index, index + 1) })}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-10 w-10 p-0 text-danger hover:bg-danger/5 sm:h-8 sm:w-8" label={`Hapus slide ${index + 1}`} tooltip="Hapus slide" disabled={slides.length <= 1} onClick={() => setPendingAction({ type: "delete-slide", index })}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton></div></div><div className="grid gap-3 lg:grid-cols-2"><Field id={`${block.id}-slide-${index}-title`} label="Judul slide"><Input id={`${block.id}-slide-${index}-title`} value={slide.title || ""} maxLength={180} onChange={(event) => updateSlide(index, { title: event.target.value })} /></Field><div className="lg:col-span-2"><ImageSourceField id={`${block.id}-slide-${index}-image`} label="Gambar slide (opsional)" value={slide.src || ""} alt={slide.alt || ""} onValueChange={(src) => updateSlide(index, { src })} hint="Pilih gambar dari komputer atau masukkan URL HTTPS." /></div><div className="lg:col-span-2"><Field id={`${block.id}-slide-${index}-content`} label="Isi slide (opsional)"><Textarea id={`${block.id}-slide-${index}-content`} rows={3} maxLength={3000} value={slide.content || ""} onChange={(event) => updateSlide(index, { content: event.target.value })} placeholder="Ringkas poin utama slide ini." /></Field></div>{slide.src && <div className="space-y-3 lg:col-span-2"><DecorativeImageControl id={`${block.id}-slide-${index}-decorative`} decorative={slide.decorative !== false} onChange={(decorative) => updateSlide(index, { decorative })} />{slide.decorative === false && <Field id={`${block.id}-slide-${index}-alt`} label="Alt text gambar" hint="Wajib untuk gambar yang membawa informasi."><Input id={`${block.id}-slide-${index}-alt`} value={slide.alt || ""} maxLength={280} onChange={(event) => updateSlide(index, { alt: event.target.value })} /></Field>}</div>}</div></article>)}</div>
      </>}
      </div>
      <ConfirmDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)} title={pendingTitle} description={pendingDescription} confirmLabel={pendingAction?.type === "delete-slide" ? "Hapus slide" : "Gunakan manual"} cancelLabel="Batal" icon="solar:trash-bin-trash-bold" destructive={pendingAction?.type === "delete-slide"} onConfirm={confirmAction} />
    </div>
  );
}

function VideoBlockFields({ block, onChange }) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const hasUrl = Boolean(block.url?.trim());
  const urlId = `${block.id}-url`;
  const captionId = `${block.id}-caption`;
  return (
    <div className="aapm-editor-video-fields aapm-editor-media-fields space-y-3">
      <div className="aapm-editor-media-row aapm-editor-video-row grid items-start gap-3">
        <Field id={urlId} label="Tautan video" required hint="YouTube, Vimeo, atau file video HTTPS/internal.">
          <Input id={urlId} type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://youtu.be/..." value={block.url || ""} onChange={(event) => onChange({ url: event.target.value })} required />
        </Field>
        <Field id={captionId} label="Keterangan learner" hint="Opsional; singkatkan hal yang perlu diperhatikan.">
          <Textarea id={captionId} rows={1} maxLength={600} value={block.caption || ""} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Contoh: Perhatikan tiga tanda awal perubahan kualitas air." />
        </Field>
      </div>
      {hasUrl && <div className="aapm-editor-media-actions flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen((open) => !open)}><AapmIcon name={previewOpen ? "chevronUp" : "eye"} className="h-3.5 w-3.5" />{previewOpen ? "Tutup pratinjau" : "Pratinjau video"}</Button></div>}
      {previewOpen && hasUrl && <div className="border-t border-border pt-3"><LessonMedia module={{ title: block.caption || "Video materi", videoUrl: block.url }} /></div>}
    </div>
  );
}

/** Primary content of a block, edited inline on the canvas. */
function BlockContentFields({ block, onChange }) {
  const set = (field, value) => onChange({ [field]: value });
  const fieldId = (field) => `${block.id}-${field}`;
  switch (block.type) {
    case "richText":
      return <RichTextEditor id={fieldId("rich-text")} value={block.content || ""} onChange={(content) => set("content", content)} onUploadImage={uploadEditorialImage} />;
    case "heading":
      return (
        <Input
          id={fieldId("heading-content")}
          aria-label="Judul bagian"
          className="aapm-block__heading-input"
          data-level={block.level || 2}
          value={block.content || ""}
          maxLength={500}
          placeholder="Tulis judul bagian…"
          onChange={(event) => set("content", event.target.value)}
        />
      );
    case "image":
      return (
        <div className="grid gap-3">
          <ImageSourceField id={fieldId("image-source")} value={block.src || ""} alt={block.alt || ""} onValueChange={(src) => set("src", src)} previewRatio={block.ratio || "natural"} previewWidth={block.width || "standard"} previewAlign={block.align || "left"} previewPosition={block.position || "center"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={fieldId("image-caption")} label="Keterangan (opsional)"><Input id={fieldId("image-caption")} value={block.caption || ""} maxLength={600} onChange={(event) => set("caption", event.target.value)} /></Field>
            {block.decorative === false ? <Field id={fieldId("image-alt")} label="Alt text" hint="Wajib untuk gambar yang membawa informasi."><Input id={fieldId("image-alt")} value={block.alt || ""} maxLength={280} onChange={(event) => set("alt", event.target.value)} /></Field> : null}
          </div>
        </div>
      );
    case "table": return <TableBlockFields block={block} onChange={onChange} />;
    case "slides": return <SlidesBlockFields block={block} onChange={onChange} />;
    case "video": return <VideoBlockFields block={block} onChange={onChange} />;
    case "link":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={fieldId("link-label")} label="Label tautan"><Input id={fieldId("link-label")} value={block.label || ""} maxLength={160} onChange={(event) => set("label", event.target.value)} /></Field>
          <Field id={fieldId("link-url")} label="URL HTTPS / internal"><Input id={fieldId("link-url")} value={block.url || ""} inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." onChange={(event) => set("url", event.target.value)} /></Field>
          <div className="sm:col-span-2"><Field id={fieldId("link-description")} label="Konteks (opsional)"><Textarea id={fieldId("link-description")} rows={2} maxLength={600} value={block.description || ""} onChange={(event) => set("description", event.target.value)} /></Field></div>
        </div>
      );
    case "cta": {
      const buttonVariant = block.variant === "secondary" ? "secondary" : block.variant === "outline" ? "outline" : "primary";
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={fieldId("cta-label")} label="Label tombol"><Input id={fieldId("cta-label")} value={block.label || ""} maxLength={120} onChange={(event) => set("label", event.target.value)} /></Field>
            <Field id={fieldId("cta-url")} label="URL HTTPS / internal"><Input id={fieldId("cta-url")} value={block.url || ""} inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." onChange={(event) => set("url", event.target.value)} /></Field>
          </div>
          <div className={cn("aapm-block__cta-preview", ctaAlignmentClass[block.align || "left"] || ctaAlignmentClass.left)} aria-label="Pratinjau tombol aksi">
            <Button type="button" variant={buttonVariant} size={block.size || "md"} data-editorial-cta-tone={block.tone || "green"} data-editorial-cta-variant={block.variant || "primary"} data-editorial-cta-radius={block.radius || "md"} className={cn("max-w-full whitespace-normal", block.width === "full" && "w-full")}>
              {block.label || "Contoh tombol aksi"}{block.icon !== "none" ? <AapmIcon name={block.icon || "arrowRight"} /> : null}
            </Button>
          </div>
        </div>
      );
    }
    case "callout":
      return (
        <div className="grid gap-3">
          <Field id={fieldId("callout-title")} label="Judul sorotan"><Input id={fieldId("callout-title")} value={block.title || ""} maxLength={160} onChange={(event) => set("title", event.target.value)} /></Field>
          <Field id={fieldId("callout-content")} label="Isi sorotan"><Textarea id={fieldId("callout-content")} rows={3} maxLength={2400} value={block.content || ""} onChange={(event) => set("content", event.target.value)} /></Field>
        </div>
      );
    default:
      return null;
  }
}

/** Presentation options of a block, shown in the inspector only when selected. */
function BlockSettingsFields({ block, onChange }) {
  const set = (field, value) => onChange({ [field]: value });
  const fieldId = (field) => `${block.id}-settings-${field}`;
  switch (block.type) {
    case "richText":
      return <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} label="Perataan teks" />;
    case "heading":
      return (
        <>
          <OptionGroup id={fieldId("level")} label="Tingkat judul" value={String(block.level || 2)} onChange={(level) => set("level", Number(level))} options={[{ value: "2", label: "Bagian" }, { value: "3", label: "Sub" }, { value: "4", label: "Detail" }]} />
          <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} />
        </>
      );
    case "image":
      return (
        <>
          <OptionGroup id={fieldId("ratio")} label="Rasio" value={block.ratio || "natural"} onChange={(ratio) => set("ratio", ratio)} options={[{ value: "natural", label: "Asli" }, { value: "wide", label: "16:9" }, { value: "standard", label: "4:3" }, { value: "square", label: "1:1" }]} />
          {block.ratio && block.ratio !== "natural" ? <OptionGroup id={fieldId("position")} label="Fokus crop" value={block.position || "center"} onChange={(position) => set("position", position)} options={[{ value: "top", label: "Atas" }, { value: "center", label: "Tengah" }, { value: "bottom", label: "Bawah" }]} /> : null}
          <OptionGroup id={fieldId("width")} label="Lebar" value={block.width || "standard"} onChange={(width) => set("width", width)} options={WIDTH_OPTIONS} />
          <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} />
          <ImageProportionHint src={block.src} ratio={block.ratio || "natural"} />
          <DecorativeImageControl id={fieldId("decorative")} decorative={block.decorative !== false} onChange={(decorative) => set("decorative", decorative)} />
        </>
      );
    case "table":
      return (
        <>
          <OptionGroup id={fieldId("density")} label="Kepadatan" value={block.density || "comfortable"} onChange={(density) => set("density", density)} options={[{ value: "comfortable", label: "Nyaman" }, { value: "compact", label: "Padat" }]} />
          <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} />
        </>
      );
    case "slides":
    case "video":
      return <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} />;
    case "link":
      return (
        <>
          <OptionGroup id={fieldId("variant")} label="Gaya" value={block.variant || "card"} onChange={(variant) => set("variant", variant)} options={[{ value: "card", label: "Kartu" }, { value: "soft", label: "Lembut" }, { value: "inline", label: "Inline" }]} />
          <ToneField id={fieldId("tone")} value={block.tone || "neutral"} options={TONE_OPTIONS} onChange={(tone) => set("tone", tone)} />
          <OptionGroup id={fieldId("icon")} label="Ikon" value={block.icon || "link"} onChange={(icon) => set("icon", icon)} options={[{ value: "link", label: "Tautan" }, { value: "arrowRight", label: "Panah" }, { value: "none", label: "Tanpa" }]} />
          <OptionGroup id={fieldId("width")} label="Lebar" value={block.width || "standard"} onChange={(width) => set("width", width)} options={WIDTH_OPTIONS} />
          <OptionGroup id={fieldId("target")} label="Buka di" value={block.target || "auto"} onChange={(target) => set("target", target)} options={TARGET_OPTIONS} />
          <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} />
        </>
      );
    case "cta":
      return (
        <>
          <OptionGroup id={fieldId("variant")} label="Gaya tombol" value={block.variant || "primary"} onChange={(variant) => set("variant", variant)} options={[{ value: "primary", label: "Isi" }, { value: "secondary", label: "Netral" }, { value: "outline", label: "Garis" }]} />
          <ToneField id={fieldId("tone")} value={block.tone || "green"} options={TONE_OPTIONS.filter((option) => option.value !== "neutral").concat(TONE_OPTIONS[0])} onChange={(tone) => set("tone", tone)} />
          <OptionGroup id={fieldId("size")} label="Ukuran" value={block.size || "md"} onChange={(size) => set("size", size)} options={[{ value: "sm", label: "Kecil" }, { value: "md", label: "Standar" }, { value: "lg", label: "Besar" }]} />
          <OptionGroup id={fieldId("radius")} label="Sudut" value={block.radius || "md"} onChange={(radius) => set("radius", radius)} options={[{ value: "sm", label: "Rapat" }, { value: "md", label: "Standar" }, { value: "lg", label: "Lembut" }, { value: "pill", label: "Pill" }]} />
          <OptionGroup id={fieldId("icon")} label="Ikon" value={block.icon || "arrowRight"} onChange={(icon) => set("icon", icon)} options={[{ value: "arrowRight", label: "Panah", icon: "arrowRight" }, { value: "check", label: "Centang", icon: "glyphCheck" }, { value: "play", label: "Putar", icon: "play" }, { value: "none", label: "Tanpa ikon", icon: "close" }]} />
          <OptionGroup id={fieldId("width")} label="Lebar tombol" value={block.width || "auto"} onChange={(width) => set("width", width)} options={[{ value: "auto", label: "Sesuai label" }, { value: "full", label: "Penuh" }]} />
          <OptionGroup id={fieldId("target")} label="Buka di" value={block.target || "auto"} onChange={(target) => set("target", target)} options={TARGET_OPTIONS} />
          <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} />
        </>
      );
    case "callout":
      return (
        <>
          <ToneField id={fieldId("tone")} label="Nada" value={block.tone || "info"} options={CALLOUT_TONES} onChange={(tone) => set("tone", tone)} />
          <OptionGroup id={fieldId("variant")} label="Gaya" value={block.variant || "soft"} onChange={(variant) => set("variant", variant)} options={[{ value: "soft", label: "Lembut" }, { value: "solid", label: "Solid" }, { value: "outline", label: "Garis" }]} />
          <OptionGroup id={fieldId("icon")} label="Ikon" value={block.icon || "info"} onChange={(icon) => set("icon", icon)} options={[{ value: "info", label: "Info", icon: "info" }, { value: "target", label: "Target", icon: "target" }, { value: "warning", label: "Peringatan", icon: "warning" }, { value: "check", label: "Centang", icon: "check" }, { value: "none", label: "Tanpa ikon", icon: "close" }]} />
          <OptionGroup id={fieldId("density")} label="Kepadatan" value={block.density || "comfortable"} onChange={(density) => set("density", density)} options={[{ value: "comfortable", label: "Nyaman" }, { value: "compact", label: "Kompak" }]} />
          <OptionGroup id={fieldId("width")} label="Lebar" value={block.width || "standard"} onChange={(width) => set("width", width)} options={WIDTH_OPTIONS} />
          <AlignmentField id={fieldId("align")} value={block.align} onChange={(align) => set("align", align)} />
        </>
      );
    case "divider":
      return (
        <>
          <OptionGroup id={fieldId("style")} label="Gaya garis" value={block.style || "subtle"} onChange={(style) => set("style", style)} options={[{ value: "subtle", label: "Halus" }, { value: "strong", label: "Tegas" }, { value: "dashed", label: "Putus" }]} />
          <OptionGroup id={fieldId("spacing")} label="Jarak" value={block.spacing || "comfortable"} onChange={(spacing) => set("spacing", spacing)} options={[{ value: "compact", label: "Rapat" }, { value: "comfortable", label: "Lega" }]} />
        </>
      );
    default:
      return null;
  }
}

function editorialPreviewReady(block) {
  if (!block || typeof block !== "object") return false;
  switch (block.type) {
    case "richText":
    case "heading":
      return Boolean(String(block.content || "").trim());
    case "image":
      return Boolean(safeEditorialImage(block.src));
    case "video":
      return Boolean(String(block.url || "").trim());
    case "link":
    case "cta":
      return Boolean(String(block.label || "").trim() && String(block.url || "").trim());
    case "callout":
      return Boolean(String(block.title || "").trim() || String(block.content || "").trim());
    case "table":
      return Array.isArray(block.columns) && block.columns.some((column) => String(column || "").trim())
        && Array.isArray(block.rows) && block.rows.some((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim()));
    case "slides":
      if (block.presentationUrl || block.pptxUrl) return true;
      return Array.isArray(block.slides) && block.slides.some((slide) => Boolean(
        String(slide?.title || "").trim()
        || String(slide?.content || "").trim()
        || safeEditorialImage(slide?.src),
      ));
    case "divider":
      return true;
    default:
      return false;
  }
}

const editorialPreviewHint = {
  richText: "Isi teks akan tampil di learner.",
  heading: "Judul akan tampil di learner.",
  image: "Pilih gambar untuk melihat frame learner.",
  video: "Tambahkan URL video untuk melihat pemutar learner.",
  link: "Isi label dan URL untuk melihat tautan learner.",
  cta: "Isi label dan URL untuk melihat CTA learner.",
  callout: "Isi judul atau isi sorotan untuk melihat callout learner.",
  table: "Isi kolom dan baris untuk melihat tabel learner.",
  slides: "Tambahkan slide atau unggah presentasi untuk melihat galeri learner.",
  divider: "Pemisah memakai token jarak learner.",
};

function MediaSummary({ icon, title, meta }) {
  return (
    <div className="aapm-block__media-summary">
      <IconTile icon={icon} hue="orange" size="lg" shape="circle" variant="badge" />
      <div className="min-w-0">
        <p className="aapm-text-label m-0 truncate">{title}</p>
        {meta ? <p className="aapm-text-caption m-0 truncate">{meta}</p> : null}
      </div>
    </div>
  );
}

/** Read mode: the block exactly as learners see it (heavy players summarised). */
function BlockPreview({ block }) {
  const document = React.useMemo(() => createEditorialDocument([block]), [block]);
  if (!editorialPreviewReady(block)) {
    return (
      <div className="aapm-block__placeholder">
        <AapmIcon name={editorIcon(block.type)} />
        <span>{editorialPreviewHint[block.type] || "Klik untuk mengisi blok ini."}</span>
      </div>
    );
  }
  if (block.type === "slides") {
    const meta = block.presentationUrl
      ? `${String(block.presentationFormat || block.source || "file").toUpperCase()} · ${block.slideCount || "?"} slide`
      : `${(block.slides || []).length} slide manual`;
    return <MediaSummary icon="presentation" title={block.title || block.presentationName || "Rangkaian slide"} meta={meta} />;
  }
  if (block.type === "video") return <MediaSummary icon="video" title={block.caption || "Video materi"} meta={block.url} />;
  return <div className="aapm-block__render"><EditorialContent document={document} title="Pratinjau blok" /></div>;
}

/**
 * One block on the canvas. Unselected it renders as the learner sees it;
 * selected it exposes only its primary content (style lives in the inspector).
 */
function BlockFrame({ block, index, total, selected, onSelect, onDone, onChange, onMove, onDuplicate, onRemove }) {
  const meta = blockMeta[block.type];
  const label = meta?.label || "Elemen materi";
  const editor = selected ? <BlockContentFields block={block} onChange={onChange} /> : null;
  return (
    <section
      id={contentBlockAnchorId(block.id)}
      className="aapm-block"
      data-selected={selected ? "true" : undefined}
      data-editorial-block={block.type}
      data-editorial-block-id={block.id}
      aria-label={`Blok ${index + 1}: ${label}`}
    >
      <div className="aapm-block__bar">
        <span className="aapm-block__type"><AapmIcon name={editorIcon(block.type)} />{label}</span>
        <div className="aapm-block__tools">
          <IconButton size="sm" icon="chevronUp" label="Naikkan blok" tooltip="Naikkan" disabled={index === 0} onClick={() => onMove(index, index - 1)} />
          <IconButton size="sm" icon="chevronDown" label="Turunkan blok" tooltip="Turunkan" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} />
          <OverflowMenu
            label={`Aksi blok ${index + 1}`}
            items={[
              { id: "duplicate", label: "Duplikat", icon: "copy", onSelect: () => onDuplicate(index) },
              { id: "top", label: "Pindah ke awal", icon: "arrowUp", disabled: index === 0, onSelect: () => onMove(index, 0) },
              { id: "bottom", label: "Pindah ke akhir", icon: "arrowDown", disabled: index === total - 1, onSelect: () => onMove(index, total - 1) },
              { id: "delete", label: "Hapus blok", icon: "delete", tone: "danger", onSelect: () => onRemove(index) },
            ]}
          />
          {selected ? <Button type="button" size="sm" variant="secondary" onClick={onDone}>Selesai</Button> : null}
        </div>
      </div>
      {selected && editor ? (
        <div className="aapm-block__editor">{editor}</div>
      ) : (
        <>
          <div className="aapm-block__preview" aria-hidden="true"><BlockPreview block={block} /></div>
          {!selected ? <button type="button" className="aapm-block__hit" aria-label={`Edit blok ${index + 1}: ${outlineLabelForBlock(block, index)}`} onClick={onSelect} /> : null}
        </>
      )}
    </section>
  );
}

const insertableTypes = editorialBlockLibrary.map((block) => block.type);

const quickBlockLabels = Object.freeze({
  richText: "Teks kaya",
  heading: "Judul",
  slides: "Slide",
  image: "Gambar",
  table: "Tabel",
  callout: "Sorotan",
  link: "Tautan",
  cta: "CTA",
  divider: "Pemisah",
  video: "Video",
});

const BLOCK_GROUPS = [
  { label: "Teks", types: ["richText", "heading", "callout"] },
  { label: "Media", types: ["image", "slides", "video"] },
  { label: "Struktur", types: ["table", "divider"] },
  { label: "Aksi", types: ["link", "cta"] },
];

/** Insert menu items, grouped the same way as the block picker. */
export const editorialInsertGroups = BLOCK_GROUPS
  .map((group) => ({
    label: group.label,
    items: group.types
      .filter((type) => insertableTypes.includes(type))
      .map((type) => ({ type, label: quickBlockLabels[type] || blockMeta[type]?.label, icon: editorIcon(type) })),
  }))
  .filter((group) => group.items.length);

const BLOCK_DESCRIPTIONS = {
  richText: "Paragraf, daftar, gambar inline",
  heading: "Penanda bagian materi",
  callout: "Info, peringatan, atau insight",
  image: "Foto, ilustrasi, atau GIF",
  slides: "PPTX, PDF, atau slide manual",
  video: "YouTube, Vimeo, atau file video",
  table: "Data hingga 8 kolom",
  divider: "Jeda visual antar bagian",
  link: "Rujukan bacaan lanjutan",
  cta: "Tombol aksi menonjol",
};

/** Grouped block library (insert menu, empty canvas, inspector). */
function BlockPicker({ onPick, disabled = false }) {
  return (
    <div className="aapm-block-picker">
      {BLOCK_GROUPS.map((group) => (
        <div key={group.label} className="aapm-block-picker__group">
          <p className="aapm-text-overline m-0">{group.label}</p>
          {group.types.filter((type) => insertableTypes.includes(type)).map((type) => (
            <button key={type} type="button" className="aapm-block-picker__item" disabled={disabled} onClick={() => onPick(type)} data-editor-add-item={type}>
              <IconTile icon={editorIcon(type)} hue={["image", "slides", "video"].includes(type) ? "orange" : type === "cta" || type === "link" ? "blue" : "green"} size="sm" shape="circle" />
              <span className="min-w-0">
                <span className="block font-medium">{quickBlockLabels[type] || blockMeta[type]?.label}</span>
                <span className="aapm-text-caption block">{BLOCK_DESCRIPTIONS[type]}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** "+" between blocks: insert exactly where the author is looking. */
function InsertPoint({ onInsert, disabled }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="aapm-insert-point" data-open={open ? "true" : undefined}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="aapm-insert-point__button" aria-label="Sisipkan blok di sini" disabled={disabled}>
            <AapmIcon name="plus" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="aapm-block-picker-popover">
          <BlockPicker onPick={(type) => { setOpen(false); onInsert(type); }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Inspector "Blok" tab content, portalled from the composer. */
function BlockInspector({ block, index, total, onChange, onDuplicate, onRemove }) {
  if (!block) {
    return (
      <p className="aapm-text-support m-0">Pilih blok dari Susun atau kanvas. Isi diedit langsung di kanvas; gaya dan tata letaknya diatur di sini.</p>
    );
  }
  const meta = blockMeta[block.type];
  const settings = <BlockSettingsFields block={block} onChange={onChange} />;
  return (
    <div className="grid gap-4" data-block-inspector={block.type}>
      <div className="flex items-center gap-3">
        <IconTile icon={editorIcon(block.type)} hue="green" size="md" shape="circle" />
        <div className="min-w-0">
          <p className="aapm-text-label m-0">{meta?.label || "Blok"}</p>
          <p className="aapm-text-caption m-0">Blok {index + 1} dari {total}</p>
        </div>
      </div>
      {insertableTypes.includes(block.type)
        ? settings
        : <p className="aapm-text-support m-0">Blok ini tidak memiliki pengaturan tampilan.</p>}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="button" size="sm" variant="secondary" leadingIcon="copy" onClick={() => onDuplicate(index)}>Duplikat</Button>
        <Button type="button" size="sm" variant="danger-soft" leadingIcon="delete" onClick={() => onRemove(index)}>Hapus</Button>
      </div>
    </div>
  );
}

function outlineLabelForBlock(block, index) {
  const detail = String(block.content || block.title || block.caption || block.label || "").replace(/<[^>]+>/g, " ").replace(/[#*_>`~|]+/g, " ").replace(/\s+/g, " ").trim();
  if (detail) return detail.slice(0, 72);
  return `${blockMeta[block.type]?.label || "Elemen materi"} ${index + 1}`;
}

function EditorialQualityPanel({ signals, onNavigate, blockCount = 0, textLength = 0 }) {
  const blocking = signals.filter((signal) => signal.severity === "blocking");
  const advice = signals.filter((signal) => signal.severity !== "blocking");
  const state = blocking.length ? "blocking" : advice.length ? "advice" : "ready";
  const title = { blocking: `${blocking.length} hal perlu dilengkapi sebelum simpan`, advice: `${advice.length} saran kualitas materi`, ready: "Materi siap disimpan" }[state];
  return (
    <section className="aapm-editorial-quality" aria-label="Pemeriksaan kualitas materi" data-editorial-quality={state}>
      <details open={state === "blocking"}>
        <summary>
          <AapmIcon name={state === "ready" ? "check" : state === "blocking" ? "danger" : "insight"} />
          <span className="min-w-0 flex-1">{title}</span>
          <span className="aapm-meta">{blockCount} blok · {textLength.toLocaleString("id-ID")} karakter</span>
          {signals.length ? <AapmIcon name="chevronDown" className="aapm-accordion-chevron" /> : null}
        </summary>
        {signals.length ? (
          <ul>
            {signals.map((signal, index) => (
              <li key={`${signal.code}-${signal.blockId || index}`}>
                <AapmIcon name={signal.severity === "blocking" ? "danger" : "info"} />
                <span className="min-w-0 flex-1">{signal.message}</span>
                {signal.blockId ? <Button type="button" size="sm" variant="ghost" onClick={() => onNavigate(signal.blockId)}>Buka</Button> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  );
}

const isEditableTarget = (target) => target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true'], .ProseMirror"));

const EditorialComposer = React.forwardRef(function EditorialComposer({ value, fallback = "", legacyVideoUrl = "", onChange, onLegacyVideoChange, settingsContainer = null, outlineContainer = null, onSelectionChange, onOutlineSelect }, ref) {
  const blocks = editorialComposerBlocks(value, fallback, legacyVideoUrl);
  const textLength = editorialTextLength(blocks);
  const qualitySignals = React.useMemo(() => getEditorialQualitySignals(blocks), [blocks]);
  const blockingSignals = qualitySignals.filter((signal) => signal.severity === "blocking");
  const [announcement, setAnnouncement] = React.useState("");
  const [pendingBlockDelete, setPendingBlockDelete] = React.useState(null);
  const [selectedId, setSelectedId] = React.useState("");
  const focusTargetRef = React.useRef("");
  const selectedIndex = blocks.findIndex((block) => block.id === selectedId);
  const selectedBlock = selectedIndex >= 0 ? blocks[selectedIndex] : null;
  const full = blocks.length >= 80;
  const outlineItems = React.useMemo(() => blocks.map((block, index) => ({
    id: block.id,
    label: blockMeta[block.type]?.label || "Elemen materi",
    detail: outlineLabelForBlock(block, index),
  })), [blocks]);

  React.useEffect(() => {
    if (selectedId && selectedIndex < 0) setSelectedId("");
  }, [selectedId, selectedIndex]);

  React.useEffect(() => {
    onSelectionChange?.(selectedBlock ? { id: selectedBlock.id, type: selectedBlock.type } : null);
  }, [onSelectionChange, selectedBlock?.id, selectedBlock?.type]);

  const commit = (nextBlocks) => {
    const currentDocument = parseEditorialDocument(value);
    const nextDocument = createEditorialDocument(nextBlocks, currentDocument?.presentation);
    if (editorialTextLength(nextDocument.blocks) > EDITORIAL_TEXT_LIMIT) {
      setAnnouncement("Isi materi sudah mencapai batas maksimum.");
      return false;
    }
    onChange(nextDocument.blocks.length ? nextDocument : null);
    if (legacyVideoUrl.trim()) onLegacyVideoChange?.("");
    return true;
  };
  const updateBlock = (index, patch) => commit(blocks.map((block, currentIndex) => currentIndex === index ? { ...block, ...patch } : block));

  const selectBlock = React.useCallback((id, { scroll = false } = {}) => {
    setSelectedId(id);
    if (scroll) focusTargetRef.current = id;
  }, []);

  const insertBlockAt = (type, insertionIndex) => {
    const block = createEditorialBlock(type);
    if (!block || full) return;
    const nextBlocks = [...blocks];
    nextBlocks.splice(insertionIndex, 0, block);
    if (!commit(nextBlocks)) return;
    selectBlock(block.id, { scroll: true });
    setAnnouncement(`${blockMeta[type]?.label || "Elemen"} ditambahkan pada urutan ${insertionIndex + 1}.`);
  };
  const addContentBlock = (type) => insertBlockAt(type, selectedIndex >= 0 ? selectedIndex + 1 : blocks.length);
  const moveContentBlock = (sourceIndex, destinationIndex) => {
    if (commit(moveInList(blocks, sourceIndex, destinationIndex))) {
      focusTargetRef.current = blocks[sourceIndex]?.id || "";
      setAnnouncement(`Blok dipindahkan ke urutan ${destinationIndex + 1}.`);
    }
  };
  const duplicateContentBlock = (index) => {
    const source = blocks[index];
    const fresh = source ? createEditorialBlock(source.type) : null;
    if (!source || !fresh || full) return;
    const copy = { ...JSON.parse(JSON.stringify(source)), id: fresh.id };
    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, copy);
    if (commit(nextBlocks)) {
      selectBlock(copy.id, { scroll: true });
      setAnnouncement("Blok diduplikasi.");
    }
  };
  const requestRemoveContentBlock = (index) => {
    const block = blocks[index];
    if (block) setPendingBlockDelete({ id: block.id, label: blockMeta[block.type]?.label || "elemen" });
  };
  const removeContentBlock = () => {
    const targetId = pendingBlockDelete?.id;
    if (!targetId || !blocks.some((block) => block.id === targetId)) {
      setPendingBlockDelete(null);
      return;
    }
    if (commit(blocks.filter((block) => block.id !== targetId))) {
      setSelectedId("");
      setAnnouncement(`${pendingBlockDelete.label} dihapus.`);
    }
    setPendingBlockDelete(null);
  };

  React.useEffect(() => {
    const targetId = focusTargetRef.current;
    if (!targetId || typeof window === "undefined") return undefined;
    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(contentBlockAnchorId(targetId));
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.querySelector(".aapm-block__editor input, .aapm-block__editor textarea, .aapm-block__editor .ProseMirror")?.focus({ preventScroll: true });
    });
    focusTargetRef.current = "";
    return () => window.cancelAnimationFrame(frameId);
  }, [blocks, selectedId]);

  const openSignal = (blockId) => selectBlock(blockId, { scroll: true });

  React.useImperativeHandle(ref, () => ({
    addElement: addContentBlock,
    deselect: () => setSelectedId(""),
    validate: () => {
      if (!blockingSignals.length) return true;
      const first = blockingSignals[0];
      if (first?.blockId) openSignal(first.blockId);
      setAnnouncement(`Lengkapi ${blockingSignals.length} elemen sebelum menyimpan modul.`);
      return false;
    },
  }));

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && selectedId && !isEditableTarget(event.target)) {
      event.preventDefault();
      setSelectedId("");
    }
  };

  return (
    <div className="aapm-editorial-composer" data-editorial-mode="ordered-flow" onKeyDown={handleKeyDown}>
      <div className="aapm-visually-hidden" aria-live="polite">{announcement}</div>
      <EditorialQualityPanel signals={qualitySignals} onNavigate={openSignal} blockCount={blocks.length} textLength={textLength} />

      {blocks.length ? (
        <div className="aapm-block-flow" aria-label="Alur blok materi">
          <InsertPoint disabled={full} onInsert={(type) => insertBlockAt(type, 0)} />
          {blocks.map((block, index) => (
            <React.Fragment key={block.id}>
              <BlockFrame
                block={block}
                index={index}
                total={blocks.length}
                selected={block.id === selectedId}
                onSelect={() => selectBlock(block.id)}
                onDone={() => setSelectedId("")}
                onChange={(patch) => updateBlock(index, patch)}
                onMove={moveContentBlock}
                onDuplicate={duplicateContentBlock}
                onRemove={requestRemoveContentBlock}
              />
              <InsertPoint disabled={full} onInsert={(type) => insertBlockAt(type, index + 1)} />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <section className="aapm-block-empty" id="editorial-insert-rail" data-editorial-insert-rail aria-label="Mulai materi">
          <StateView kind="empty" icon="fileAdd" hue="green" compact framed={false} title="Mulai dari blok pertama" description="Pilih jenis blok. Teks kaya cocok untuk narasi; tambahkan media atau struktur saat dibutuhkan." />
          <BlockPicker onPick={(type) => insertBlockAt(type, 0)} />
        </section>
      )}

      {outlineContainer ? createPortal(
        <EditorialOutlineList
          items={outlineItems}
          selectedId={selectedId}
          onSelect={(id) => { selectBlock(id, { scroll: true }); onOutlineSelect?.(); }}
          onMove={moveContentBlock}
        />,
        outlineContainer,
      ) : null}

      {settingsContainer ? createPortal(
        <BlockInspector
          block={selectedBlock}
          index={selectedIndex}
          total={blocks.length}
          onChange={(patch) => updateBlock(selectedIndex, patch)}
          onDuplicate={duplicateContentBlock}
          onRemove={requestRemoveContentBlock}
        />,
        settingsContainer,
      ) : null}

      <ConfirmDialog open={Boolean(pendingBlockDelete)} onOpenChange={(open) => !open && setPendingBlockDelete(null)} title="Hapus blok materi?" description={`${pendingBlockDelete?.label || "Elemen"} akan dihapus dari alur learner. Perubahan baru tersimpan setelah Anda menekan Simpan.`} confirmLabel="Hapus blok" cancelLabel="Batal" icon="delete" destructive onConfirm={removeContentBlock} />
    </div>
  );
});

EditorialComposer.displayName = "EditorialComposer";

export default EditorialComposer;
