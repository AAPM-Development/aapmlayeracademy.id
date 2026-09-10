// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import RichTextEditor from "@/components/admin/RichTextEditor";
import UploadProgress from "@/components/admin/UploadProgress";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import { EditorialContent } from "@/components/academy/EditorialContent";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

const contentBlockAnchorId = editorialBlockAnchorId;

function Field({ label, children, hint = "", id, required = false, error = "" }) {
  const descriptionId = id && (hint || error) ? `${id}-description` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span className="ml-1 text-brand-orange" aria-hidden="true">*</span>}</Label>
      {children}
      {(hint || error) && <p id={descriptionId} className={cn("text-[10px] leading-4", error ? "text-danger" : "text-muted-foreground")} role={error ? "alert" : undefined}>{error || hint}</p>}
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

function AlignmentField({ id, value = "left", onChange, label = "Rata horizontal" }) {
  return <Field id={id} label={label}><Select value={value || "left"} onValueChange={onChange}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Kiri</SelectItem><SelectItem value="center">Tengah</SelectItem><SelectItem value="right">Kanan</SelectItem></SelectContent></Select></Field>;
}

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
    <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-subtle px-3 py-2.5">
      <Checkbox id={id} checked={Boolean(decorative)} onCheckedChange={(checked) => onChange(Boolean(checked))} className="mt-0.5 h-4 w-4" />
      <Label htmlFor={id} className="cursor-pointer text-xs font-medium leading-5">Gambar dekoratif <span className="font-normal text-muted-foreground">— alt text tidak diperlukan karena tidak membawa informasi.</span></Label>
    </div>
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
      <div className="grid gap-3 sm:grid-cols-2"><AlignmentField id={`${block.id}-table-align`} value={block.align || "left"} onChange={(align) => onChange({ align })} label="Rata tabel" /><Field id={`${block.id}-table-density`} label="Kepadatan"><Select value={block.density || "comfortable"} onValueChange={(density) => onChange({ density })}><SelectTrigger id={`${block.id}-table-density`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Nyaman · ruang lega</SelectItem><SelectItem value="compact">Padat · data banyak</SelectItem></SelectContent></Select></Field></div>
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
    <div className="space-y-3">
      <Field id={`${block.id}-slides-title`} label="Judul rangkaian slide (opsional)"><Input id={`${block.id}-slides-title`} value={block.title || ""} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="Judul rangkaian slide" /></Field>
      <AlignmentField id={`${block.id}-slides-align`} value={block.align || "left"} onChange={(align) => onChange({ align })} label="Rata rangkaian" />
      <div className="rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-semibold">Sumber slide</div><div className="mt-1 text-[11px] leading-5 text-muted-foreground">PPTX/PPT, Keynote, ODP, atau PDF · maksimal 50 MB</div></div><div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant={source === "manual" ? "default" : "outline"} onClick={switchToManual}><AapmIcon name="edit" className="h-3.5 w-3.5" />Manual</Button><input id={presentationInputId} type="file" accept={EDITORIAL_PRESENTATION_ACCEPT} className="sr-only" disabled={uploadState.status === "loading"} onChange={(event) => { const [file] = event.target.files || []; event.target.value = ""; if (file) choosePresentation(file); }} /><Button asChild type="button" size="sm" variant={source !== "manual" ? "default" : "outline"} disabled={uploadState.status === "loading"} aria-busy={uploadState.status === "loading"}><label htmlFor={presentationInputId} className="cursor-pointer"><AapmIcon name={uploadState.status === "loading" ? "loading" : "fileCheck"} className={cn("h-3.5 w-3.5", uploadState.status === "loading" && "animate-spin")} />{uploadState.status === "loading" ? "Mengunggah…" : source !== "manual" ? `Ganti ${editorialPresentationMeta(source).shortLabel}` : "Unggah file"}</label></Button></div></div></div>
      {pendingPresentation && <div className="flex flex-col gap-3 rounded-xl border border-brand-orange/25 bg-brand-orange/5 p-3 sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite"><div className="min-w-0"><p className="text-xs font-semibold">Siap mengganti sumber slide</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{pendingPresentation.name}</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={uploadState.status === "loading"} onClick={() => void uploadPresentationFile(pendingPresentation)}><AapmIcon name={uploadState.status === "loading" ? "loading" : "fileCheck"} className={cn("h-3.5 w-3.5", uploadState.status === "loading" && "animate-spin")} />{uploadState.status === "loading" ? "Mengunggah…" : "Gunakan file"}</Button><Button type="button" size="sm" variant="outline" disabled={uploadState.status === "loading"} onClick={() => setPendingPresentation(null)}>Batal</Button></div></div>}
      {uploadState.status === "loading" && <UploadProgress progress={uploadState.progress} label={uploadState.message} onCancel={() => uploadControllerRef.current?.abort()} />}
      {uploadState.status !== "idle" && uploadState.status !== "loading" && <p className={cn("inline-flex items-center gap-1.5 text-[10px] leading-4", uploadState.status === "error" ? "text-danger" : uploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={uploadState.status === "error" ? "alert" : "status"} aria-live="polite"><AapmIcon name={uploadState.status === "success" ? "approve" : "info"} className="h-3.5 w-3.5 shrink-0" />{uploadState.message}</p>}
      {source !== "manual" ? <div className="rounded-xl border border-border bg-background p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><AapmIcon name="fileCheck" className="h-4 w-4 shrink-0 text-brand-orange" /><div className="min-w-0"><div className="truncate text-sm font-semibold">{block.presentationName || block.pptxName || "File presentasi"}</div><div className="text-[10px] text-muted-foreground">{source === "pptx" && block.slideCount ? `${block.slideCount} slide · ` : ""}{editorialPresentationMeta(source).label}</div></div></div><div className="flex flex-wrap items-center justify-end gap-2"><Badge variant="soft" className="bg-tint-green text-brand-green">{editorialPresentationMeta(source).shortLabel}</Badge><Button type="button" size="sm" variant="outline" disabled={!block.presentationUrl && !block.pptxUrl} onClick={() => setPreviewOpen((open) => !open)}><AapmIcon name={previewOpen ? "chevronUp" : "eye"} className="h-3.5 w-3.5" />{previewOpen ? "Tutup" : source === "ppt" || source === "key" || source === "odp" ? "Lihat file" : "Pratinjau"}</Button></div></div>{previewOpen && (block.presentationUrl || block.pptxUrl) && <div className="mt-3 border-t border-border pt-3"><EditorialPresentation src={block.presentationUrl || block.pptxUrl} format={source} title={block.title || block.presentationName || block.pptxName || "Presentasi"} name={block.presentationName || block.pptxName} declaredSlideCount={block.slideCount} compact /></div>}</div> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle p-3"><div className="text-xs font-semibold">Rangkaian slide manual</div><Button type="button" size="sm" variant="outline" disabled={slides.length >= 12} onClick={() => onChange({ slides: [...slides, createEditorialSlide(slides.length + 1)] })}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah slide</Button></div>
        <div className="space-y-3">{slides.map((slide, index) => <article key={slide.id} className="rounded-xl border border-border bg-background p-3 shadow-sm sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><span className="text-xs font-semibold">Slide {index + 1} dari {slides.length}</span><div className="flex flex-wrap gap-1.5"><IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Naikkan slide ${index + 1}`} tooltip="Naikkan slide satu posisi" disabled={index === 0} onClick={() => onChange({ slides: moveInList(slides, index, index - 1) })}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Turunkan slide ${index + 1}`} tooltip="Turunkan slide satu posisi" disabled={index === slides.length - 1} onClick={() => onChange({ slides: moveInList(slides, index, index + 1) })}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-10 w-10 p-0 text-danger hover:bg-danger/5 sm:h-8 sm:w-8" label={`Hapus slide ${index + 1}`} tooltip="Hapus slide" disabled={slides.length <= 1} onClick={() => setPendingAction({ type: "delete-slide", index })}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton></div></div><div className="grid gap-3 lg:grid-cols-2"><Field id={`${block.id}-slide-${index}-title`} label="Judul slide"><Input id={`${block.id}-slide-${index}-title`} value={slide.title || ""} maxLength={180} onChange={(event) => updateSlide(index, { title: event.target.value })} /></Field><div className="lg:col-span-2"><ImageSourceField id={`${block.id}-slide-${index}-image`} label="Gambar slide (opsional)" value={slide.src || ""} alt={slide.alt || ""} onValueChange={(src) => updateSlide(index, { src })} hint="Pilih gambar dari komputer atau masukkan URL HTTPS." /></div><div className="lg:col-span-2"><Field id={`${block.id}-slide-${index}-content`} label="Isi slide (opsional)"><Textarea id={`${block.id}-slide-${index}-content`} rows={3} maxLength={3000} value={slide.content || ""} onChange={(event) => updateSlide(index, { content: event.target.value })} placeholder="Ringkas poin utama slide ini." /></Field></div>{slide.src && <div className="space-y-3 lg:col-span-2"><DecorativeImageControl id={`${block.id}-slide-${index}-decorative`} decorative={slide.decorative !== false} onChange={(decorative) => updateSlide(index, { decorative })} />{slide.decorative === false && <Field id={`${block.id}-slide-${index}-alt`} label="Alt text gambar" hint="Wajib untuk gambar yang membawa informasi."><Input id={`${block.id}-slide-${index}-alt`} value={slide.alt || ""} maxLength={280} onChange={(event) => updateSlide(index, { alt: event.target.value })} /></Field>}</div>}</div></article>)}</div>
      </>}
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
    <div className="space-y-4">
      <Field id={urlId} label="Tautan video" required hint="YouTube, Vimeo, atau file video HTTPS/internal.">
        <Input id={urlId} type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://youtu.be/..." value={block.url || ""} onChange={(event) => onChange({ url: event.target.value })} required />
      </Field>
      <Field id={captionId} label="Keterangan untuk learner (disarankan)" hint="Sebutkan apa yang perlu diperhatikan atau dilakukan setelah menonton.">
        <Textarea id={captionId} rows={2} maxLength={600} value={block.caption || ""} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Contoh: Perhatikan tiga tanda awal perubahan kualitas air." />
      </Field>
      <AlignmentField id={`${urlId}-align`} value={block.align || "left"} onChange={(align) => onChange({ align })} label="Rata video" />
      {hasUrl && <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen((open) => !open)}><AapmIcon name={previewOpen ? "chevronUp" : "eye"} className="h-3.5 w-3.5" />{previewOpen ? "Tutup pratinjau" : "Pratinjau video"}</Button>}
      {previewOpen && hasUrl && <div className="border-t border-border pt-3"><LessonMedia module={{ title: block.caption || "Video materi", videoUrl: block.url }} /></div>}
    </div>
  );
}

function ContentBlockFields({ block, onChange }) {
  const set = (field, value) => onChange({ [field]: value });
  const fieldId = (field) => `${block.id}-${field}`;
  switch (block.type) {
    case "richText":
      return <div className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><p className="max-w-2xl text-xs leading-5 text-muted-foreground">Gunakan paragraf untuk narasi. Tambahkan blok teks baru bila ingin menyisipkan media di antara dua bagian tulisan.</p><AlignmentField id={fieldId("rich-text-align")} value={block.align || "left"} onChange={(align) => set("align", align)} label="Rata teks learner" /></div><RichTextEditor id={fieldId("rich-text")} value={block.content || ""} onChange={(content) => set("content", content)} onUploadImage={uploadEditorialImage} /></div>;
    case "slides": return <SlidesBlockFields block={block} onChange={onChange} />;
    case "image": return (
      <div className="space-y-3">
        <ImageSourceField id={fieldId("image-source")} value={block.src || ""} alt={block.alt || ""} onValueChange={(src) => set("src", src)} previewRatio={block.ratio || "natural"} previewWidth={block.width || "standard"} previewAlign={block.align || "left"} previewPosition={block.position || "center"} />
        {block.src && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={fieldId("image-ratio")} label="Rasio tampilan"><Select value={block.ratio || "natural"} onValueChange={(ratio) => set("ratio", ratio)}><SelectTrigger id={fieldId("image-ratio")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="natural">Rasio asli</SelectItem><SelectItem value="wide">16:9 · lebar</SelectItem><SelectItem value="standard">4:3 · standar</SelectItem><SelectItem value="square">1:1 · persegi</SelectItem></SelectContent></Select></Field>
            <Field id={fieldId("image-width")} label="Lebar di learner"><Select value={block.width || "standard"} onValueChange={(width) => set("width", width)}><SelectTrigger id={fieldId("image-width")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standar · sejajar narasi</SelectItem><SelectItem value="wide">Lebar · menonjol</SelectItem></SelectContent></Select></Field>
            <Field id={fieldId("image-align")} label="Rata horizontal"><Select value={block.align || "left"} onValueChange={(align) => set("align", align)}><SelectTrigger id={fieldId("image-align")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Kiri</SelectItem><SelectItem value="center">Tengah</SelectItem><SelectItem value="right">Kanan</SelectItem></SelectContent></Select></Field>
            <Field id={fieldId("image-position")} label="Posisi fokus saat crop"><Select value={block.position || "center"} onValueChange={(position) => set("position", position)}><SelectTrigger id={fieldId("image-position")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top">Atas</SelectItem><SelectItem value="center">Tengah</SelectItem><SelectItem value="bottom">Bawah</SelectItem></SelectContent></Select></Field>
          </div>
          <ImageProportionHint src={block.src} ratio={block.ratio || "natural"} />
          <DecorativeImageControl id={fieldId("image-decorative")} decorative={block.decorative !== false} onChange={(decorative) => set("decorative", decorative)} />
        </>}
        <div className="grid gap-3 sm:grid-cols-2">{block.decorative === false && <Field id={fieldId("image-alt")} label="Alt text" hint="Wajib untuk gambar yang membawa informasi."><Input id={fieldId("image-alt")} value={block.alt || ""} maxLength={280} onChange={(event) => set("alt", event.target.value)} /></Field>}<Field id={fieldId("image-caption")} label="Keterangan (opsional)"><Input id={fieldId("image-caption")} value={block.caption || ""} maxLength={600} onChange={(event) => set("caption", event.target.value)} /></Field></div>
      </div>
    );
    case "table": return <TableBlockFields block={block} onChange={onChange} />;
    case "heading": return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><Field id={fieldId("heading-content")} label="Judul bagian"><Input id={fieldId("heading-content")} value={block.content || ""} maxLength={500} onChange={(event) => set("content", event.target.value)} /></Field><Field id={fieldId("heading-level")} label="Hierarki"><Select value={String(block.level || 2)} onValueChange={(level) => set("level", Number(level))}><SelectTrigger id={fieldId("heading-level")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2">Bagian utama</SelectItem><SelectItem value="3">Subbagian</SelectItem><SelectItem value="4">Detail</SelectItem></SelectContent></Select></Field><AlignmentField id={fieldId("heading-align")} value={block.align || "left"} onChange={(align) => set("align", align)} label="Rata judul" /></div>;
    case "video": return <VideoBlockFields block={block} onChange={onChange} />;
    case "link": return <div className="grid gap-3 sm:grid-cols-2">
      <Field id={fieldId("link-label")} label="Label tautan"><Input id={fieldId("link-label")} value={block.label || ""} maxLength={160} onChange={(event) => set("label", event.target.value)} /></Field>
      <Field id={fieldId("link-url")} label="URL HTTPS / internal"><Input id={fieldId("link-url")} value={block.url || ""} inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." onChange={(event) => set("url", event.target.value)} /></Field>
      <div className="sm:col-span-2"><Field id={fieldId("link-description")} label="Konteks (opsional)"><Textarea id={fieldId("link-description")} rows={2} maxLength={600} value={block.description || ""} onChange={(event) => set("description", event.target.value)} /></Field></div>
      <Field id={fieldId("link-variant")} label="Gaya tautan"><Select value={block.variant || "card"} onValueChange={(variant) => set("variant", variant)}><SelectTrigger id={fieldId("link-variant")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="card">Kartu</SelectItem><SelectItem value="soft">Kartu lembut</SelectItem><SelectItem value="inline">Inline · ringan</SelectItem></SelectContent></Select></Field>
      <Field id={fieldId("link-tone")} label="Aksen warna tautan"><Select value={block.tone || "neutral"} onValueChange={(tone) => set("tone", tone)}><SelectTrigger id={fieldId("link-tone")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="neutral">Netral</SelectItem><SelectItem value="green">Hijau</SelectItem><SelectItem value="orange">Orange</SelectItem><SelectItem value="blue">Biru</SelectItem><SelectItem value="violet">Violet</SelectItem></SelectContent></Select></Field>
      <Field id={fieldId("link-icon")} label="Ikon tautan"><Select value={block.icon || "link"} onValueChange={(icon) => set("icon", icon)}><SelectTrigger id={fieldId("link-icon")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link">Tautan</SelectItem><SelectItem value="arrowRight">Panah kanan</SelectItem><SelectItem value="none">Tanpa ikon</SelectItem></SelectContent></Select></Field>
      <Field id={fieldId("link-width")} label="Lebar di learner"><Select value={block.width || "standard"} onValueChange={(width) => set("width", width)}><SelectTrigger id={fieldId("link-width")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standar · bacaan</SelectItem><SelectItem value="wide">Lebar · menonjol</SelectItem></SelectContent></Select></Field>
      <Field id={fieldId("link-target")} label="Target tautan"><Select value={block.target || "auto"} onValueChange={(target) => set("target", target)}><SelectTrigger id={fieldId("link-target")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Otomatis · eksternal tab baru</SelectItem><SelectItem value="same">Tab saat ini</SelectItem><SelectItem value="new">Tab baru</SelectItem></SelectContent></Select></Field>
      <AlignmentField id={fieldId("link-align")} value={block.align || "left"} onChange={(align) => set("align", align)} label="Rata tautan" />
    </div>;
    case "cta": {
      const buttonVariant = block.variant === "secondary" ? "secondary" : block.variant === "outline" ? "outline" : "default";
      return <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2"><Field id={fieldId("cta-label")} label="Label tombol"><Input id={fieldId("cta-label")} value={block.label || ""} maxLength={120} onChange={(event) => set("label", event.target.value)} /></Field><Field id={fieldId("cta-url")} label="URL HTTPS / internal"><Input id={fieldId("cta-url")} value={block.url || ""} inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." onChange={(event) => set("url", event.target.value)} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field id={fieldId("cta-variant")} label="Gaya tombol"><Select value={block.variant || "primary"} onValueChange={(variant) => set("variant", variant)}><SelectTrigger id={fieldId("cta-variant")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary">Primary · isi</SelectItem><SelectItem value="secondary">Secondary · netral</SelectItem><SelectItem value="outline">Outline · garis</SelectItem></SelectContent></Select></Field><Field id={fieldId("cta-tone")} label="Aksen warna"><Select value={block.tone || "green"} onValueChange={(tone) => set("tone", tone)}><SelectTrigger id={fieldId("cta-tone")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="green">Hijau</SelectItem><SelectItem value="orange">Orange</SelectItem><SelectItem value="blue">Biru</SelectItem><SelectItem value="violet">Violet</SelectItem><SelectItem value="neutral">Netral</SelectItem></SelectContent></Select></Field><Field id={fieldId("cta-size")} label="Ukuran"><Select value={block.size || "md"} onValueChange={(size) => set("size", size)}><SelectTrigger id={fieldId("cta-size")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sm">Kompak</SelectItem><SelectItem value="md">Standar</SelectItem><SelectItem value="lg">Prominen</SelectItem></SelectContent></Select></Field></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field id={fieldId("cta-radius")} label="Roundness"><Select value={block.radius || "md"} onValueChange={(radius) => set("radius", radius)}><SelectTrigger id={fieldId("cta-radius")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sm">Rapat</SelectItem><SelectItem value="md">Standar</SelectItem><SelectItem value="lg">Lembut</SelectItem><SelectItem value="pill">Pill</SelectItem></SelectContent></Select></Field><Field id={fieldId("cta-icon")} label="Ikon CTA"><Select value={block.icon || "arrowRight"} onValueChange={(icon) => set("icon", icon)}><SelectTrigger id={fieldId("cta-icon")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="arrowRight">Panah kanan</SelectItem><SelectItem value="check">Centang</SelectItem><SelectItem value="play">Putar</SelectItem><SelectItem value="none">Tanpa ikon</SelectItem></SelectContent></Select></Field><Field id={fieldId("cta-target")} label="Target CTA"><Select value={block.target || "auto"} onValueChange={(target) => set("target", target)}><SelectTrigger id={fieldId("cta-target")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Otomatis · eksternal tab baru</SelectItem><SelectItem value="same">Tab saat ini</SelectItem><SelectItem value="new">Tab baru</SelectItem></SelectContent></Select></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field id={fieldId("cta-align")} label="Rata tombol"><Select value={block.align || "left"} onValueChange={(align) => set("align", align)}><SelectTrigger id={fieldId("cta-align")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Kiri</SelectItem><SelectItem value="center">Tengah</SelectItem><SelectItem value="right">Kanan</SelectItem></SelectContent></Select></Field><Field id={fieldId("cta-width")} label="Lebar tombol"><Select value={block.width || "auto"} onValueChange={(width) => set("width", width)}><SelectTrigger id={fieldId("cta-width")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Sesuai label</SelectItem><SelectItem value="full">Penuh kontainer</SelectItem></SelectContent></Select></Field></div>
        <div className={cn("flex rounded-xl border border-border bg-surface-subtle p-3", ctaAlignmentClass[block.align || "left"] || ctaAlignmentClass.left)} aria-label="Pratinjau tombol aksi"><Button type="button" variant={buttonVariant} size={block.size || "md"} data-editorial-cta-tone={block.tone || "green"} data-editorial-cta-variant={block.variant || "primary"} data-editorial-cta-radius={block.radius || "md"} className={cn("max-w-full whitespace-normal", block.width === "full" && "w-full")}>{block.label || "Contoh tombol aksi"}{block.icon !== "none" && <AapmIcon name={block.icon || "arrowRight"} className="shrink-0" />}</Button></div>
      </div>;
    }
    case "callout": return <div className="grid gap-3 sm:grid-cols-2"><Field id={fieldId("callout-title")} label="Judul sorotan"><Input id={fieldId("callout-title")} value={block.title || ""} maxLength={160} onChange={(event) => set("title", event.target.value)} /></Field><Field id={fieldId("callout-content")} label="Isi sorotan"><Textarea id={fieldId("callout-content")} rows={2} maxLength={2400} value={block.content || ""} onChange={(event) => set("content", event.target.value)} /></Field><Field id={fieldId("callout-tone")} label="Nada sorotan"><Select value={block.tone || "info"} onValueChange={(tone) => set("tone", tone)}><SelectTrigger id={fieldId("callout-tone")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info · hijau</SelectItem><SelectItem value="practice">Praktik · orange</SelectItem><SelectItem value="warning">Peringatan · hangat</SelectItem><SelectItem value="blue">Informasi · biru</SelectItem><SelectItem value="violet">Insight · violet</SelectItem><SelectItem value="neutral">Netral · abu</SelectItem></SelectContent></Select></Field><Field id={fieldId("callout-variant")} label="Gaya sorotan"><Select value={block.variant || "soft"} onValueChange={(variant) => set("variant", variant)}><SelectTrigger id={fieldId("callout-variant")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soft">Lembut</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="outline">Outline</SelectItem></SelectContent></Select></Field><Field id={fieldId("callout-icon")} label="Ikon sorotan"><Select value={block.icon || "info"} onValueChange={(icon) => set("icon", icon)}><SelectTrigger id={fieldId("callout-icon")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="target">Target</SelectItem><SelectItem value="warning">Peringatan</SelectItem><SelectItem value="check">Centang</SelectItem><SelectItem value="none">Tanpa ikon</SelectItem></SelectContent></Select></Field><Field id={fieldId("callout-density")} label="Kepadatan"><Select value={block.density || "comfortable"} onValueChange={(density) => set("density", density)}><SelectTrigger id={fieldId("callout-density")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Nyaman</SelectItem><SelectItem value="compact">Kompak</SelectItem></SelectContent></Select></Field><Field id={fieldId("callout-width")} label="Lebar sorotan"><Select value={block.width || "standard"} onValueChange={(width) => set("width", width)}><SelectTrigger id={fieldId("callout-width")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standar · bacaan</SelectItem><SelectItem value="wide">Lebar · menonjol</SelectItem></SelectContent></Select></Field><AlignmentField id={fieldId("callout-align")} value={block.align || "left"} onChange={(align) => set("align", align)} label="Rata sorotan" /></div>;
    case "divider": return <div className="grid gap-3 sm:grid-cols-2"><Field id={fieldId("divider-style")} label="Gaya pemisah"><Select value={block.style || "subtle"} onValueChange={(style) => set("style", style)}><SelectTrigger id={fieldId("divider-style")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subtle">Halus</SelectItem><SelectItem value="strong">Tegas</SelectItem><SelectItem value="dashed">Putus-putus</SelectItem></SelectContent></Select></Field><Field id={fieldId("divider-spacing")} label="Jarak vertikal"><Select value={block.spacing || "comfortable"} onValueChange={(spacing) => set("spacing", spacing)}><SelectTrigger id={fieldId("divider-spacing")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Rapat</SelectItem><SelectItem value="comfortable">Lega</SelectItem></SelectContent></Select></Field></div>;
    default: return null;
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

function EditorialElementPreview({ block }) {
  const document = React.useMemo(() => createEditorialDocument([block]), [block]);
  const ready = editorialPreviewReady(block);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const previewId = `${block.id}-learner-preview`;
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-brand-green/20 bg-background" aria-label="Pratinjau elemen learner" data-editorial-element-preview>
      <button
        type="button"
        className="flex w-full items-center gap-2 bg-surface-subtle px-3 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
        aria-expanded={previewOpen}
        aria-controls={previewId}
        data-editorial-element-preview-toggle
        onClick={() => setPreviewOpen((open) => !open)}
      >
        <AapmIcon name="eye" className="h-3.5 w-3.5 text-brand-green" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-green">Pratinjau learner</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{ready ? (previewOpen ? "Tutup" : "Buka") : "Belum lengkap"}</span>
        <AapmIcon name={previewOpen ? "chevronUp" : "chevronDown"} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {previewOpen && <div id={previewId} className="min-h-12 border-t border-border p-3 sm:p-4">
        {ready
          ? <EditorialContent document={document} title="Pratinjau elemen" />
          : <div className="flex min-h-12 items-center gap-2 rounded-lg border border-dashed border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground"><AapmIcon name="info" className="h-4 w-4 shrink-0 text-brand-orange" />{editorialPreviewHint[block.type] || "Lengkapi elemen untuk melihat pratinjau learner."}</div>}
      </div>}
    </section>
  );
}

function ContentBlockCard({ block, index, total, onChange, onMove, onRemove }) {
  const meta = blockMeta[block.type];
  const mediaTone = ["image", "slides", "video"].includes(block.type);
  return (
    <article
      id={contentBlockAnchorId(block.id)}
      className={cn("aapm-editorial-block aapm-token-card scroll-mt-28 overflow-hidden", mediaTone ? "border-brand-orange/25" : "border-border")}
      data-editorial-block={block.type}
      data-editorial-block-id={block.id}
    >
      <div className="aapm-editorial-block__header flex flex-wrap items-start gap-3 border-b border-border/60 bg-surface-subtle/30 px-4 py-3 sm:px-5">
        <IconTile icon={editorIcon(block.type)} tone={mediaTone ? "orange" : "green"} size="md" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">{meta?.label || "Elemen materi"}</h4>
            <Badge variant="outline" className="text-[10px]">Blok {index + 1}/{total}</Badge>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconButton size="sm" className="h-9 w-9 p-0" label={`Naikkan ${meta?.label || "elemen"}`} tooltip="Naikkan elemen" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
            <AapmIcon name="chevronUp" className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton size="sm" className="h-9 w-9 p-0" label={`Turunkan ${meta?.label || "elemen"}`} tooltip="Turunkan elemen" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>
            <AapmIcon name="chevronDown" className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton size="sm" className="h-9 w-9 p-0 text-danger hover:bg-danger/5 hover:text-danger" label={`Hapus ${meta?.label || "elemen"}`} tooltip="Hapus elemen" onClick={() => onRemove(index)}>
            <AapmIcon name="delete" className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
      <div className="aapm-editorial-block__body px-4 py-4 sm:px-5 sm:py-5">
        <ContentBlockFields block={block} onChange={onChange} />
        <EditorialElementPreview block={block} />
      </div>
    </article>
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

export const editorialInsertActions = Object.freeze([
  ...insertableTypes.map((type) => ({
    type,
    label: quickBlockLabels[type],
    icon: editorIcon(type),
  })),
]);

function EditorialOutlineList({ items, activeItemId, onNavigate }) {
  return (
    <nav aria-label="Urutan blok materi" className="space-y-1">
      {items.map((item, index) => {
        const active = item.id === activeItemId;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "location" : undefined}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-orange/50",
              active ? "bg-surface-subtle text-foreground" : "text-muted-foreground hover:bg-surface-subtle/70 hover:text-foreground",
            )}
          >
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold", active ? "bg-brand-green text-white" : item.tone === "media" ? "bg-tint-orange text-brand-orange" : "bg-surface-subtle text-muted-foreground")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold leading-4"><AapmIcon name={item.icon} className="h-3 w-3 shrink-0" /><span className="truncate">{item.label}</span></span>
            </span>
            <AapmIcon name="chevronRight" className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", active && "text-brand-green")} />
          </button>
        );
      })}
    </nav>
  );
}

function EditorialOutline({ items, activeItemId, onNavigate }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const elementCount = items.length;
  const activeItem = items.find((item) => item.id === activeItemId);
  const activeLabel = activeItem?.label || "Belum dipilih";
  const navigate = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <div className="aapm-editorial-outline min-w-0 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-24 xl:self-start" data-editorial-outline>
      <section className="aapm-token-panel rounded-xl border border-border/70 bg-surface-subtle/55 p-2 xl:hidden">
        <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50" aria-expanded={mobileOpen} aria-controls="editorial-outline-mobile-list" onClick={() => setMobileOpen((open) => !open)}>
          <IconTile icon="table" tone="green" size="sm" />
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Blok materi</span><span className="block truncate text-[10px] leading-4 text-muted-foreground">{elementCount} blok · Aktif: {activeLabel}</span></span>
          <AapmIcon name={mobileOpen ? "chevronUp" : "chevronDown"} className="h-4 w-4 text-muted-foreground" />
        </button>
        {mobileOpen && <div id="editorial-outline-mobile-list" className="mt-2 max-h-72 overflow-y-auto border-t border-border pt-2"><EditorialOutlineList items={items} activeItemId={activeItemId} onNavigate={navigate} /></div>}
      </section>

      <aside className="aapm-token-panel hidden overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-none xl:block" aria-label="Blok materi editor">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2"><IconTile icon="table" tone="green" size="sm" /><div><h3 className="text-xs font-semibold">Blok materi</h3><p className="max-w-[12rem] truncate text-[10px] text-muted-foreground">{elementCount} blok · Aktif: {activeLabel}</p></div></div>
        </div>
        <div className="aapm-scrollbar max-h-[calc(100vh-10rem)] overflow-y-auto p-2"><EditorialOutlineList items={items} activeItemId={activeItemId} onNavigate={onNavigate} /></div>
      </aside>
    </div>
  );
}

function outlineLabelForBlock(block, index) {
  const detail = String(block.content || block.title || block.caption || block.label || "").trim();
  if (detail) return detail.slice(0, 72);
  return `${blockMeta[block.type]?.label || "Elemen materi"} ${index + 1}`;
}

function EditorialQualityPanel({ signals, onNavigate }) {
  const blocking = signals.filter((signal) => signal.severity === "blocking");
  const advice = signals.filter((signal) => signal.severity !== "blocking");
  const status = blocking.length ? "Lengkapi sebelum simpan" : advice.length ? "Periksa kualitas materi" : "Siap untuk disimpan";
  const tone = blocking.length ? "border-danger/25 bg-danger/5" : advice.length ? "border-tint-orange-border bg-tint-orange" : "border-tint-green-border bg-tint-green";
  const icon = blocking.length ? "solar:danger-triangle-bold" : advice.length ? "solar:lightbulb-bolt-bold-duotone" : "checkRead";
  const iconTone = blocking.length ? "text-danger" : advice.length ? "text-tint-orange-foreground" : "text-tint-green-foreground";

  return (
    <section className={cn("aapm-editorial-quality aapm-token-alert rounded-2xl border p-4 shadow-sm", tone)} aria-label="Pemeriksaan kualitas materi" data-editorial-quality={blocking.length ? "blocking" : advice.length ? "advice" : "ready"}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("aapm-token-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/70", iconTone)}><AapmIcon name={icon} className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{status}</h3><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Pemeriksaan ini membantu kualitas learner; keputusan isi dan urutan tetap di tangan editor.</p></div>
        <Badge variant="outline" className="bg-background/60 text-[10px]">{blocking.length ? `${blocking.length} perlu dilengkapi` : advice.length ? `${advice.length} catatan` : "Tidak ada catatan"}</Badge>
      </div>
      {signals.length > 0 && <ul className="mt-3 space-y-2 border-t border-current/10 pt-3 text-xs leading-5 text-muted-foreground">{signals.map((signal, index) => <li key={`${signal.code}-${signal.blockId || index}`} className="flex items-start gap-2"><AapmIcon name={signal.severity === "blocking" ? "solar:danger-circle-bold" : "solar:info-circle-bold"} className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", signal.severity === "blocking" ? "text-danger" : "text-muted-foreground")} /><span className="min-w-0 flex-1">{signal.message}</span>{signal.blockId && <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-[10px]" onClick={() => onNavigate(contentBlockAnchorId(signal.blockId))}>Lihat</Button>}</li>)}</ul>}
    </section>
  );
}

const EditorialComposer = React.forwardRef(function EditorialComposer({ value, fallback = "", legacyVideoUrl = "", onChange, onLegacyVideoChange }, ref) {
  const blocks = editorialComposerBlocks(value, fallback, legacyVideoUrl);
  const textLength = editorialTextLength(blocks);
  const qualitySignals = React.useMemo(() => getEditorialQualitySignals(blocks), [blocks]);
  const blockingSignals = qualitySignals.filter((signal) => signal.severity === "blocking");
  const outlineItems = React.useMemo(() => blocks.map((block, index) => ({
    id: contentBlockAnchorId(block.id),
    label: outlineLabelForBlock(block, index),
    icon: editorIcon(block.type),
    tone: ["image", "slides", "video"].includes(block.type) ? "media" : "canvas",
  })), [blocks]);
  const hasOutline = blocks.length > 0;
  const outlineItemKey = outlineItems.map((item) => item.id).join("|");
  const [announcement, setAnnouncement] = React.useState("");
  const [pendingBlockDelete, setPendingBlockDelete] = React.useState(null);
  const [activeOutlineId, setActiveOutlineId] = React.useState("");
  const quickScrollTargetRef = React.useRef("");
  const outlineNavigationLockRef = React.useRef(0);

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
  const scrollToSection = (sectionId) => {
    if (typeof document === "undefined") return;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const navigateOutline = (sectionId) => {
    outlineNavigationLockRef.current = Date.now() + 900;
    setActiveOutlineId(sectionId);
    scrollToSection(sectionId);
  };

  React.useEffect(() => {
    if (outlineItemKey.split("|").includes(activeOutlineId)) return;
    setActiveOutlineId(outlineItems[0]?.id || "");
  }, [activeOutlineId, outlineItemKey, outlineItems]);

  React.useEffect(() => {
    if (!hasOutline || typeof window === "undefined" || typeof window.IntersectionObserver !== "function") return undefined;
    const targetIds = outlineItemKey.split("|").filter(Boolean);
    const targets = targetIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (!targets.length) return undefined;

    const observer = new window.IntersectionObserver((entries) => {
      if (Date.now() < outlineNavigationLockRef.current) return;
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => Math.abs(left.boundingClientRect.top - 140) - Math.abs(right.boundingClientRect.top - 140));
      if (visible[0]?.target?.id) setActiveOutlineId(visible[0].target.id);
    }, { rootMargin: "-120px 0px -55% 0px", threshold: [0.01, 0.25] });

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [hasOutline, outlineItemKey]);

  const addContentBlock = (type) => {
    const block = createEditorialBlock(type);
    if (!block || blocks.length >= 80) return;
    quickScrollTargetRef.current = block.id;
    const activeBlockId = activeOutlineId.startsWith("editorial-block-")
      ? activeOutlineId.slice("editorial-block-".length)
      : "";
    const activeIndex = blocks.findIndex((item) => item.id === activeBlockId);
    const insertionIndex = activeIndex >= 0 ? activeIndex + 1 : blocks.length;
    const nextBlocks = [...blocks];
    nextBlocks.splice(insertionIndex, 0, block);
    if (!commit(nextBlocks)) {
      quickScrollTargetRef.current = "";
      return;
    }
    setAnnouncement(`${blockMeta[type]?.label || "Elemen"} ditambahkan pada urutan ${insertionIndex + 1}.`);
  };
  const moveContentBlock = (sourceIndex, destinationIndex) => {
    if (commit(moveInList(blocks, sourceIndex, destinationIndex))) setAnnouncement(`Elemen dipindahkan ke urutan ${destinationIndex + 1}.`);
  };
  const requestRemoveContentBlock = (index) => {
    const block = blocks[index];
    if (block) setPendingBlockDelete({ index, label: blockMeta[block.type]?.label || "elemen" });
  };
  const removeContentBlock = () => {
    const index = pendingBlockDelete?.index;
    if (!Number.isInteger(index) || !blocks[index]) return;
    if (commit(blocks.filter((_, currentIndex) => currentIndex !== index))) setAnnouncement(`${pendingBlockDelete.label} dihapus.`);
    setPendingBlockDelete(null);
  };

  React.useEffect(() => {
    const targetId = quickScrollTargetRef.current;
    if (!targetId || typeof window === "undefined" || typeof document === "undefined") return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(contentBlockAnchorId(targetId));
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveOutlineId(target.id);
      target.querySelector("input, textarea, button")?.focus({ preventScroll: true });
    });
    quickScrollTargetRef.current = "";
    return () => window.cancelAnimationFrame(frameId);
  }, [blocks]);

  React.useImperativeHandle(ref, () => ({
    addElement: addContentBlock,
    validate: () => {
      if (!blockingSignals.length) return true;
      const first = blockingSignals[0];
      if (first?.blockId) navigateOutline(contentBlockAnchorId(first.blockId));
      setAnnouncement(`Lengkapi ${blockingSignals.length} elemen sebelum menyimpan modul.`);
      return false;
    },
  }), [addContentBlock, blockingSignals, navigateOutline]);

  return (
    <div className="aapm-editorial-composer space-y-5" data-editorial-mode="ordered-flow">
      <div className="sr-only" aria-live="polite">{announcement}</div>

      <section className="aapm-editorial-summary aapm-token-panel rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tint-green text-brand-green"><AapmIcon name="solar:pen-new-square-bold" className="h-5 w-5" /></span>
            <div className="min-w-0"><h3 className="text-sm font-semibold">Alur materi</h3><p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground">Learner melihat setiap blok sesuai urutan ini. Sisipkan teks, gambar, slide, video, tabel, atau aksi di titik yang tepat dalam narasi.</p></div>
          </div>
          <Badge variant="soft" className="bg-tint-green text-brand-green">{blocks.length} blok · {textLength.toLocaleString("id-ID")} byte konten</Badge>
        </div>
      </section>

      <EditorialQualityPanel signals={qualitySignals} onNavigate={navigateOutline} />

      <div className={cn("aapm-editorial-layout grid min-w-0 gap-5", hasOutline && "xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start")}>
        {hasOutline && <EditorialOutline items={outlineItems} activeItemId={activeOutlineId} onNavigate={navigateOutline} />}
        <div className={cn("min-w-0 space-y-5", hasOutline && "xl:col-start-1 xl:row-start-1")}>
          {blocks.length ? <section className="space-y-3" aria-label="Alur blok materi"><div className="flex flex-wrap items-center justify-between gap-2 px-1"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Urutan learner</p><Badge variant="outline">{blocks.length} blok</Badge></div><div className="space-y-5">{blocks.map((block, index) => <ContentBlockCard key={block.id} block={block} index={index} total={blocks.length} onChange={(patch) => updateBlock(index, patch)} onMove={moveContentBlock} onRemove={requestRemoveContentBlock} />)}</div></section> : <section className="rounded-2xl border border-dashed border-brand-green/30 bg-brand-green/5 p-5 text-center"><AapmIcon name="solar:document-add-bold" className="mx-auto h-6 w-6 text-brand-green" /><h3 className="mt-3 text-sm font-semibold">Mulai dari blok pertama</h3><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">Pilih teks kaya untuk menulis narasi, lalu tambahkan media atau struktur saat dibutuhkan.</p></section>}

          <section id="editorial-insert-rail" className="aapm-editorial-insert-rail rounded-2xl border border-dashed border-border bg-surface-subtle/60 p-4" aria-label="Tambah blok materi" data-editorial-insert-rail>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Tambah ke alur</h3><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Blok baru disisipkan setelah blok yang sedang aktif dalam urutan ini, atau di akhir alur.</p></div><Badge variant="outline" className="text-[10px]">Maks. 80 blok</Badge></div>
            <div className="mt-3 flex flex-wrap gap-2">{editorialInsertActions.map((action) => <Button key={action.type} type="button" size="sm" variant="outline" className="h-10" disabled={blocks.length >= 80} onClick={() => addContentBlock(action.type)}><AapmIcon name={action.icon} className="h-3.5 w-3.5" />{action.label}</Button>)}</div>
          </section>
        </div>
      </div>

      <ConfirmDialog open={Boolean(pendingBlockDelete)} onOpenChange={(open) => !open && setPendingBlockDelete(null)} title="Hapus blok materi?" description={`${pendingBlockDelete?.label || "Elemen"} akan dihapus dari alur learner. Perubahan baru tersimpan setelah Anda menekan Simpan modul.`} confirmLabel="Hapus blok" cancelLabel="Batal" icon="solar:trash-bin-trash-bold" destructive onConfirm={removeContentBlock} />
    </div>
  );
  });

EditorialComposer.displayName = "EditorialComposer";

export default EditorialComposer;
