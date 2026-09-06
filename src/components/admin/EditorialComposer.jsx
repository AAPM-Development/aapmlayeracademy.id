// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { nativeApi } from "@/api/nativeClient";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  IconButton,
  Input,
  Label,
  Textarea,
} from "@/components/primitives";
import { cn } from "@/lib/utils";
import { safeEditorialImage } from "@/lib/editorialUrls";
import {
  EDITORIAL_TEXT_LIMIT,
  createEditorialBlock,
  createEditorialSlide,
  createInlineEditorialDocument,
  editorialContentBlocks,
  editorialInlineContent,
  editorialTextLength,
  editorialVideoBlocks,
  editorialBlockLibrary,
  ensureEditorialDocument,
} from "@/lib/editorialDocument";

const blockMeta = Object.fromEntries(editorialBlockLibrary.map((item) => [item.type, item]));
const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_PRESENTATION_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_PRESENTATION_SLIDES = 50;
const imageExtensions = /\.(?:jpe?g|png|gif|webp|avif)$/i;
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

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

function SourceImagePreview({ src, alt }) {
  const [failed, setFailed] = React.useState(false);
  const issue = imageUrlIssue(src);

  React.useEffect(() => setFailed(false), [src]);

  if (!src || issue) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
      {failed ? (
        <p className="p-3 text-xs leading-5 text-danger" role="alert">Pratinjau tidak dapat dimuat. Periksa URL atau unggah gambar.</p>
      ) : (
        <img src={src} alt={alt || ""} className="aspect-video w-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function ImageSourceField({ id, value, onValueChange, alt = "", label = "Gambar / GIF", hint }) {
  const [uploadState, setUploadState] = React.useState({ status: "idle", message: "" });
  const sourceIssue = imageUrlIssue(value);
  const uploadId = `${id}-upload`;

  const uploadImage = async (file) => {
    const issue = imageFileIssue(file);
    if (issue) {
      setUploadState({ status: "error", message: issue });
      return;
    }
    setUploadState({ status: "loading", message: "Mengunggah dan memeriksa gambar…" });
    try {
      const result = await nativeApi.admin.media.uploadImage(file);
      const url = result?.media?.url;
      if (!url) throw new Error("Respons unggahan gambar tidak lengkap.");
      onValueChange(url);
      setUploadState({ status: "success", message: "Gambar siap dipakai dalam materi." });
    } catch (error) {
      setUploadState({ status: "error", message: error?.message || "Gambar tidak dapat diunggah." });
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
        <Button asChild type="button" size="sm" variant="outline" disabled={uploadState.status === "loading"}>
          <label htmlFor={uploadId} className="cursor-pointer"><AapmIcon name="fileCheck" className="h-3.5 w-3.5" />{uploadState.status === "loading" ? "Mengunggah…" : "Unggah gambar"}</label>
        </Button>
        <span className="text-[11px] leading-5 text-muted-foreground">Maks. 20 MB · JPG, PNG, GIF, WebP, AVIF</span>
      </div>
      {uploadState.status !== "idle" && <p className={cn("text-[11px] leading-5", uploadState.status === "error" ? "text-danger" : uploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={uploadState.status === "error" ? "alert" : "status"}>{uploadState.message}</p>}
      <SourceImagePreview src={value} alt={alt} />
    </div>
  );
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
    onChange({ columns: [...columns, `Kolom ${columns.length + 1}`], rows: rows.map((row) => [...row, ""]) });
  };
  const addRow = () => {
    if (rows.length >= 20) return;
    onChange({ rows: [...rows, columns.map(() => "")] });
  };

  return (
    <div className="space-y-3">
      <Field id={`${block.id}-table-title`} label="Judul tabel (opsional)">
        <Input id={`${block.id}-table-title`} value={block.title || ""} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="Contoh: Target pemeriksaan" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-xs font-semibold">Isi tabel</div><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Maksimal 8 kolom dan 20 baris. Tabel akan tetap bisa digeser di learner.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={columns.length >= 8} onClick={addColumn}><AapmIcon name="add" className="h-3.5 w-3.5" />Kolom</Button><Button type="button" size="sm" variant="outline" disabled={rows.length >= 20} onClick={addRow}><AapmIcon name="add" className="h-3.5 w-3.5" />Baris</Button></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-xs">
          <thead className="bg-surface-subtle"><tr>{columns.map((column, index) => <th key={`column-${index}`} className="min-w-36 border-b border-border p-2 text-left align-top"><label className="sr-only" htmlFor={`${block.id}-column-${index}`}>Nama kolom {index + 1}</label><Input id={`${block.id}-column-${index}`} value={column} maxLength={160} onChange={(event) => updateColumn(index, event.target.value)} className="h-8 bg-background text-xs font-semibold" /></th>)}</tr></thead>
          <tbody>{rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{columns.map((_, columnIndex) => <td key={`cell-${rowIndex}-${columnIndex}`} className="min-w-36 border-t border-border p-2 align-top"><label className="sr-only" htmlFor={`${block.id}-cell-${rowIndex}-${columnIndex}`}>Baris {rowIndex + 1}, kolom {columnIndex + 1}</label><Textarea id={`${block.id}-cell-${rowIndex}-${columnIndex}`} rows={2} maxLength={3000} value={row?.[columnIndex] || ""} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} className="min-h-16 bg-background text-xs" /></td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function SlidesBlockFields({ block, onChange }) {
  const source = block.source === "pptx" ? "pptx" : "manual";
  const slides = Array.isArray(block.slides) ? block.slides : [];
  const [uploadState, setUploadState] = React.useState({ status: "idle", message: "" });
  const [pendingPresentation, setPendingPresentation] = React.useState(null);
  const [pendingAction, setPendingAction] = React.useState(null);
  const presentationInputId = `${block.id}-presentation-upload`;
  const updateSlide = (index, patch) => onChange({ slides: slides.map((slide, currentIndex) => currentIndex === index ? { ...slide, ...patch } : slide) });

  const uploadPresentationFile = async (file) => {
    if (!file) return;
    if (!/\.pptx$/i.test(file.name || "")) {
      setUploadState({ status: "error", message: "Gunakan berkas PowerPoint .pptx. Format .ppt lama belum didukung." });
      return;
    }
    if (file.size < 1 || file.size > MAX_PRESENTATION_UPLOAD_BYTES) {
      setUploadState({ status: "error", message: `Ukuran PPTX maksimal ${readableBytes(MAX_PRESENTATION_UPLOAD_BYTES)}.` });
      return;
    }
    setUploadState({ status: "loading", message: "Memeriksa dan mengunggah PPTX…" });
    try {
      const result = await nativeApi.admin.media.uploadPresentation(file);
      const presentation = result?.presentation;
      if (!presentation?.url || !presentation?.slideCount) throw new Error("Respons unggahan PPTX tidak lengkap.");
      onChange({ source: "pptx", pptxUrl: presentation.url, pptxName: presentation.name || file.name, slideCount: presentation.slideCount, slides: [] });
      setPendingPresentation(null);
      setUploadState({ status: "success", message: "PPTX siap ditampilkan sebagai carousel learner." });
    } catch (error) {
      setUploadState({ status: "error", message: error?.message || "PPTX tidak dapat diunggah." });
    }
  };

  const choosePresentation = (file) => {
    const hasManualContent = source === "manual" && slides.some((slide) => slide.title?.trim() || slide.content?.trim() || slide.src?.trim());
    if (hasManualContent) {
      setPendingPresentation(file);
      setUploadState({ status: "idle", message: "" });
      return;
    }
    void uploadPresentationFile(file);
  };

  const switchToManual = () => {
    if (source === "pptx") {
      setPendingAction({ type: "switch-to-manual" });
      return;
    }
    onChange({ source: "manual", pptxUrl: "", pptxName: "", slideCount: 0, slides: slides.length ? slides : [createEditorialSlide(1)] });
  };

  const confirmAction = () => {
    if (pendingAction?.type === "delete-slide") onChange({ slides: slides.filter((_, currentIndex) => currentIndex !== pendingAction.index) });
    if (pendingAction?.type === "switch-to-manual") onChange({ source: "manual", pptxUrl: "", pptxName: "", slideCount: 0, slides: slides.length ? slides : [createEditorialSlide(1)] });
    setPendingAction(null);
  };

  const pendingTitle = pendingAction?.type === "delete-slide" ? "Hapus slide?" : "Kembali ke slide manual?";
  const pendingDescription = pendingAction?.type === "delete-slide" ? `Slide ${(pendingAction?.index ?? 0) + 1} akan dihapus dari rangkaian ini.` : "Referensi PPTX akan dilepas dari elemen ini. File PPTX di server tidak dihapus.";

  return (
    <div className="space-y-3">
      <Field id={`${block.id}-slides-title`} label="Judul rangkaian slide (opsional)"><Input id={`${block.id}-slides-title`} value={block.title || ""} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="Contoh: Alur pemeriksaan kandang" /></Field>
      <div className="rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-semibold">Sumber slide</div><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Buat slide manual atau tampilkan presentasi PPTX sebagai carousel learner.</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant={source === "manual" ? "default" : "outline"} onClick={switchToManual}><AapmIcon name="edit" className="h-3.5 w-3.5" />Manual</Button><input id={presentationInputId} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="sr-only" disabled={uploadState.status === "loading"} onChange={(event) => { const [file] = event.target.files || []; event.target.value = ""; if (file) choosePresentation(file); }} /><Button asChild type="button" size="sm" variant={source === "pptx" ? "default" : "outline"} disabled={uploadState.status === "loading"}><label htmlFor={presentationInputId} className="cursor-pointer"><AapmIcon name="fileCheck" className="h-3.5 w-3.5" />{source === "pptx" ? "Ganti PPTX" : "Unggah PPTX"}</label></Button></div></div></div>
      {pendingPresentation && <div className="flex flex-col gap-3 rounded-xl border border-brand-orange/25 bg-brand-orange/5 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5">PPTX baru akan menggantikan {slides.length} slide manual di elemen ini.</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void uploadPresentationFile(pendingPresentation)}>Gunakan PPTX</Button><Button type="button" size="sm" variant="outline" onClick={() => setPendingPresentation(null)}>Batal</Button></div></div>}
      {uploadState.status !== "idle" && <p className={cn("text-[10px] leading-4", uploadState.status === "error" ? "text-danger" : uploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={uploadState.status === "error" ? "alert" : "status"}>{uploadState.message}</p>}
      {source === "pptx" ? <div className="rounded-xl border border-border bg-background p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><AapmIcon name="fileCheck" className="h-4 w-4 text-brand-orange" /><span className="text-sm font-semibold">{block.pptxName || "Presentasi PowerPoint"}</span></div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{block.slideCount || 0} slide · carousel learner responsif.</p></div><Badge variant="soft" className="bg-tint-green text-brand-green">PPTX terkelola</Badge></div><p className="mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-[10px] leading-4 text-muted-foreground">1–{MAX_PRESENTATION_SLIDES} slide · maks. 50 MB · gunakan .pptx dengan media tertanam.</p></div> : <>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-semibold">Rangkaian slide manual</div><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Setiap slide dapat berisi gambar dan teks.</p></div><Button type="button" size="sm" variant="outline" disabled={slides.length >= 12} onClick={() => onChange({ slides: [...slides, createEditorialSlide(slides.length + 1)] })}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah slide</Button></div>
        <div className="space-y-3">{slides.map((slide, index) => <article key={slide.id} className="rounded-xl border border-border bg-background p-3 shadow-sm sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><span className="text-xs font-semibold">Slide {index + 1} dari {slides.length}</span><div className="flex flex-wrap gap-1.5"><IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Naikkan slide ${index + 1}`} tooltip="Naikkan slide satu posisi" disabled={index === 0} onClick={() => onChange({ slides: moveInList(slides, index, index - 1) })}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Turunkan slide ${index + 1}`} tooltip="Turunkan slide satu posisi" disabled={index === slides.length - 1} onClick={() => onChange({ slides: moveInList(slides, index, index + 1) })}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-10 w-10 p-0 text-danger hover:bg-danger/5 sm:h-8 sm:w-8" label={`Hapus slide ${index + 1}`} tooltip="Hapus slide" disabled={slides.length <= 1} onClick={() => setPendingAction({ type: "delete-slide", index })}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton></div></div><div className="grid gap-3 lg:grid-cols-2"><Field id={`${block.id}-slide-${index}-title`} label="Judul slide"><Input id={`${block.id}-slide-${index}-title`} value={slide.title || ""} maxLength={180} onChange={(event) => updateSlide(index, { title: event.target.value })} /></Field><div className="lg:col-span-2"><ImageSourceField id={`${block.id}-slide-${index}-image`} label="Gambar slide (opsional)" value={slide.src || ""} alt={slide.alt || ""} onValueChange={(src) => updateSlide(index, { src })} hint="Pilih gambar dari komputer atau masukkan URL HTTPS." /></div><div className="lg:col-span-2"><Field id={`${block.id}-slide-${index}-content`} label="Isi slide (opsional)"><Textarea id={`${block.id}-slide-${index}-content`} rows={3} maxLength={3000} value={slide.content || ""} onChange={(event) => updateSlide(index, { content: event.target.value })} placeholder="Ringkas poin utama slide ini." /></Field></div>{slide.src && <div className="space-y-3 lg:col-span-2"><DecorativeImageControl id={`${block.id}-slide-${index}-decorative`} decorative={slide.decorative !== false} onChange={(decorative) => updateSlide(index, { decorative })} />{slide.decorative === false && <Field id={`${block.id}-slide-${index}-alt`} label="Alt text gambar" hint="Wajib untuk gambar yang membawa informasi."><Input id={`${block.id}-slide-${index}-alt`} value={slide.alt || ""} maxLength={280} onChange={(event) => updateSlide(index, { alt: event.target.value })} /></Field>}</div>}</div></article>)}</div>
      </>}
      <ConfirmDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)} title={pendingTitle} description={pendingDescription} confirmLabel={pendingAction?.type === "delete-slide" ? "Hapus slide" : "Gunakan manual"} cancelLabel="Batal" icon="solar:trash-bin-trash-bold" destructive={pendingAction?.type === "delete-slide"} onConfirm={confirmAction} />
    </div>
  );
}

function ContentBlockFields({ block, onChange }) {
  const set = (field, value) => onChange({ [field]: value });
  const fieldId = (field) => `${block.id}-${field}`;
  switch (block.type) {
    case "slides": return <SlidesBlockFields block={block} onChange={onChange} />;
    case "image": return <div className="space-y-3"><ImageSourceField id={fieldId("image-source")} value={block.src || ""} alt={block.alt || ""} onValueChange={(src) => set("src", src)} />{block.src && <DecorativeImageControl id={fieldId("image-decorative")} decorative={block.decorative !== false} onChange={(decorative) => set("decorative", decorative)} />}<div className="grid gap-3 sm:grid-cols-2">{block.decorative === false && <Field id={fieldId("image-alt")} label="Alt text" hint="Wajib untuk gambar yang membawa informasi."><Input id={fieldId("image-alt")} value={block.alt || ""} maxLength={280} onChange={(event) => set("alt", event.target.value)} /></Field>}<Field id={fieldId("image-caption")} label="Keterangan (opsional)"><Input id={fieldId("image-caption")} value={block.caption || ""} maxLength={600} onChange={(event) => set("caption", event.target.value)} /></Field></div></div>;
    case "table": return <TableBlockFields block={block} onChange={onChange} />;
    case "heading": return <Field id={fieldId("heading-content")} label="Judul bagian"><Input id={fieldId("heading-content")} value={block.content || ""} maxLength={500} onChange={(event) => set("content", event.target.value)} /></Field>;
    case "link": return <div className="grid gap-3 sm:grid-cols-2"><Field id={fieldId("link-label")} label="Label tautan"><Input id={fieldId("link-label")} value={block.label || ""} maxLength={160} onChange={(event) => set("label", event.target.value)} /></Field><Field id={fieldId("link-url")} label="URL HTTPS / internal"><Input id={fieldId("link-url")} value={block.url || ""} inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." onChange={(event) => set("url", event.target.value)} /></Field><div className="sm:col-span-2"><Field id={fieldId("link-description")} label="Konteks (opsional)"><Textarea id={fieldId("link-description")} rows={2} maxLength={600} value={block.description || ""} onChange={(event) => set("description", event.target.value)} /></Field></div></div>;
    case "cta": return <div className="grid gap-3 sm:grid-cols-2"><Field id={fieldId("cta-label")} label="Label tombol"><Input id={fieldId("cta-label")} value={block.label || ""} maxLength={120} onChange={(event) => set("label", event.target.value)} /></Field><Field id={fieldId("cta-url")} label="URL HTTPS / internal"><Input id={fieldId("cta-url")} value={block.url || ""} inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." onChange={(event) => set("url", event.target.value)} /></Field></div>;
    case "callout": return <div className="grid gap-3 sm:grid-cols-2"><Field id={fieldId("callout-title")} label="Judul sorotan"><Input id={fieldId("callout-title")} value={block.title || ""} maxLength={160} onChange={(event) => set("title", event.target.value)} /></Field><Field id={fieldId("callout-content")} label="Isi sorotan"><Textarea id={fieldId("callout-content")} rows={2} maxLength={2400} value={block.content || ""} onChange={(event) => set("content", event.target.value)} /></Field></div>;
    case "divider": return <p className="text-sm leading-6 text-muted-foreground">Pemisah akan mengikuti lebar materi dan tidak memerlukan konfigurasi.</p>;
    default: return <p className="text-sm leading-6 text-muted-foreground">Elemen ini dipertahankan untuk kompatibilitas materi lama.</p>;
  }
}

function ContentBlockCard({ block, index, total, onChange, onMove, onRemove }) {
  const meta = blockMeta[block.type];
  return <article className={cn("rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-5", block.type === "slides" && "border-brand-orange/25")} data-editorial-content-block={block.type}><div className="mb-4 flex flex-wrap items-start gap-3 border-b border-border pb-3"><span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", block.type === "slides" ? "bg-tint-orange text-brand-orange" : "bg-tint-green text-brand-green")}><AapmIcon name={meta?.icon || "solar:widget-2-bold"} className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold">{meta?.label || "Elemen materi"}</h4><Badge variant="outline" className="text-[10px]">Urutan {index + 1}</Badge></div><p className="mt-1 max-w-2xl text-[10px] leading-4 text-muted-foreground">{meta?.description || "Elemen materi terstruktur."}</p></div><div className="ml-auto flex items-center gap-1"><IconButton size="sm" className="h-9 w-9 p-0" label={`Naikkan ${meta?.label || "elemen"}`} tooltip="Naikkan elemen" disabled={index === 0} onClick={() => onMove(index, index - 1)}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-9 w-9 p-0" label={`Turunkan ${meta?.label || "elemen"}`} tooltip="Turunkan elemen" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-9 w-9 p-0 text-danger hover:bg-danger/5 hover:text-danger" label={`Hapus ${meta?.label || "elemen"}`} tooltip="Hapus elemen" onClick={() => onRemove(index)}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton></div></div><ContentBlockFields block={block} onChange={onChange} /></article>;
}

function VideoCard({ block, index, total, onChange, onMove, onRemove }) {
  const hasUrl = Boolean(block.url?.trim());
  const urlId = `${block.id}-url`;
  const captionId = `${block.id}-caption`;
  return <article className="rounded-2xl border border-brand-orange/20 bg-background p-4 shadow-sm" data-editorial-video-card><div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3"><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange"><AapmIcon name="solar:play-circle-bold" className="h-4 w-4" /></span><div className="min-w-0"><div className="text-sm font-semibold">Video {index + 1}</div><div className={cn("text-[10px]", hasUrl ? "text-brand-green" : "text-brand-orange")}>{hasUrl ? "Tautan siap diputar" : "Isi tautan video"}</div></div></div><div className="ml-auto flex items-center gap-1">{total > 1 && <div role="group" aria-label={`Atur urutan Video ${index + 1}`} className="flex items-center gap-1"><IconButton size="sm" className="h-9 w-9 p-0" label={`Naikkan Video ${index + 1}`} tooltip="Naikkan video" disabled={index === 0} onClick={() => onMove(index, index - 1)}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton><IconButton size="sm" className="h-9 w-9 p-0" label={`Turunkan Video ${index + 1}`} tooltip="Turunkan video" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton></div>}<IconButton size="sm" className="h-9 w-9 p-0 text-danger hover:bg-danger/5 hover:text-danger" label={`Hapus Video ${index + 1}`} tooltip="Hapus video" onClick={() => onRemove(index)}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton></div></div><div className="space-y-4"><Field id={urlId} label="Tautan video" required hint="YouTube, Vimeo, file HTTPS, atau file internal pada /assets/, /media/, atau /uploads/."><Input id={urlId} type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://youtu.be/..." value={block.url || ""} onChange={(event) => onChange({ url: event.target.value })} required /></Field><Field id={captionId} label="Keterangan (opsional)"><Textarea id={captionId} rows={2} value={block.caption || ""} onChange={(event) => onChange({ caption: event.target.value })} placeholder="Contoh: Simak demonstrasi pemeriksaan harian." /></Field></div></article>;
}

const insertableTypes = ["slides", "image", "table", "callout", "link", "cta", "divider"];

export default function EditorialComposer({ value, fallback = "", legacyVideoUrl = "", onChange, onLegacyVideoChange }) {
  const document = ensureEditorialDocument(value);
  const storedVideos = editorialVideoBlocks(value);
  const videos = storedVideos.length ? storedVideos : legacyVideoUrl.trim() ? [{ id: "legacy-video", type: "video", url: legacyVideoUrl, caption: "" }] : [];
  const inlineContent = editorialInlineContent(value, fallback);
  const contentBlocks = editorialContentBlocks(value);
  const richTextBlock = document.blocks.find((block) => block.type === "richText");
  const existingIds = new Set(document.blocks.map((block) => block.id));
  const richTextId = richTextBlock?.id || (existingIds.has("inline-content") ? "inline-content-text" : "inline-content");
  const textLength = editorialTextLength(createInlineEditorialDocument(inlineContent, videos, richTextId, contentBlocks).blocks);
  const [announcement, setAnnouncement] = React.useState("");
  const [pendingVideoDelete, setPendingVideoDelete] = React.useState(null);
  const [pendingContentBlockDelete, setPendingContentBlockDelete] = React.useState(null);

  const commit = (nextContent = inlineContent, nextContentBlocks = contentBlocks, nextVideos = videos) => {
    const nextDocument = createInlineEditorialDocument(nextContent, nextVideos, richTextId, nextContentBlocks);
    if (editorialTextLength(nextDocument.blocks) > EDITORIAL_TEXT_LIMIT) {
      setAnnouncement("Isi materi sudah mencapai batas maksimum.");
      return;
    }
    onChange(nextDocument.blocks.length ? nextDocument : null);
    if (legacyVideoUrl.trim()) onLegacyVideoChange?.("");
  };
  const updateInlineContent = (nextContent) => commit(nextContent, contentBlocks, videos);
  const updateContentBlock = (index, patch) => commit(inlineContent, contentBlocks.map((block, currentIndex) => currentIndex === index ? { ...block, ...patch } : block), videos);
  const addContentBlock = (type) => { const block = createEditorialBlock(type); if (!block || contentBlocks.length >= 79) return; commit(inlineContent, [...contentBlocks, block], videos); setAnnouncement(`${blockMeta[type]?.label || "Elemen"} ditambahkan setelah kanvas teks.`); };
  const moveContentBlock = (sourceIndex, destinationIndex) => { commit(inlineContent, moveInList(contentBlocks, sourceIndex, destinationIndex), videos); setAnnouncement(`Elemen dipindahkan ke urutan ${destinationIndex + 1}.`); };
  const requestRemoveContentBlock = (index) => { const block = contentBlocks[index]; if (block) setPendingContentBlockDelete({ index, label: blockMeta[block.type]?.label || "elemen" }); };
  const removeContentBlock = () => { const index = pendingContentBlockDelete?.index; if (!Number.isInteger(index) || !contentBlocks[index]) return; commit(inlineContent, contentBlocks.filter((_, currentIndex) => currentIndex !== index), videos); setAnnouncement(`${pendingContentBlockDelete.label} dihapus.`); setPendingContentBlockDelete(null); };
  const addVideo = () => { const nextVideo = createEditorialBlock("video"); commit(inlineContent, contentBlocks, [...videos, nextVideo]); setAnnouncement(`Video ${videos.length + 1} ditambahkan.`); };
  const updateVideo = (index, patch) => commit(inlineContent, contentBlocks, videos.map((video, currentIndex) => currentIndex === index ? { ...video, ...patch } : video));
  const moveVideo = (sourceIndex, destinationIndex) => { commit(inlineContent, contentBlocks, moveInList(videos, sourceIndex, destinationIndex)); setAnnouncement(`Video dipindahkan ke posisi ${destinationIndex + 1}.`); };
  const requestRemoveVideo = (index) => { if (videos[index]) setPendingVideoDelete({ index }); };
  const removeVideo = () => { const index = pendingVideoDelete?.index; if (!Number.isInteger(index) || !videos[index]) return; commit(inlineContent, contentBlocks, videos.filter((_, currentIndex) => currentIndex !== index)); setAnnouncement(`Video ${index + 1} dihapus.`); setPendingVideoDelete(null); };

  return <div className="space-y-5" data-editorial-mode="hybrid">
    <div className="sr-only" aria-live="polite">{announcement}</div>
    <section className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tint-green text-brand-green"><AapmIcon name="solar:pen-new-square-bold" className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-green">Kanvas materi</p><h3 className="mt-1 text-base font-semibold">Tulis seperti di Word</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Ketik langsung, paste dari Word, lalu gunakan toolbar untuk judul, penekanan, daftar, kutipan, dan tautan.</p></div></div><Badge variant="soft" className="bg-tint-green text-brand-green">{textLength.toLocaleString("id-ID")} byte teks</Badge></div>
      <div className="mt-4"><RichTextEditor id="module-inline-editor" value={inlineContent} onChange={updateInlineContent} /></div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] leading-4 text-muted-foreground"><span><strong className="font-semibold text-foreground">Enter</strong> membuat paragraf baru</span><span><strong className="font-semibold text-foreground">Ctrl/⌘ + Z</strong> untuk mengurungkan</span><span>Paste dari Word dibersihkan secara aman</span></div>
      <div className="mt-5 rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-3.5 sm:p-4" data-editorial-insert-rail><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white"><AapmIcon name="add" className="h-4 w-4" /></span><div><p className="text-xs font-semibold">Sisipkan ke materi</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Elemen pilihan akan muncul setelah kanvas teks dan tetap bisa diurutkan.</p></div></div><Badge variant="outline" className="border-brand-orange/25 text-brand-orange">{contentBlocks.length} elemen</Badge></div><div className="mt-3 flex flex-wrap gap-2">{insertableTypes.map((type) => { const item = blockMeta[type]; return <Button key={type} type="button" size="sm" variant={type === "slides" ? "default" : "outline"} className={cn("h-9 rounded-lg text-xs", type === "slides" && "bg-brand-orange text-white hover:bg-brand-orange/90")} aria-label={`Sisipkan ${item?.label || type}`} onClick={() => addContentBlock(type)}><AapmIcon name={item?.icon || "add"} className="h-3.5 w-3.5" />{item?.label || type}</Button>; })}</div></div>
    </section>
    {contentBlocks.length > 0 && <section className="space-y-3" aria-label="Elemen materi terstruktur"><div className="flex flex-wrap items-center justify-between gap-2 px-1"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Elemen tersisip</p><p className="mt-1 text-xs text-muted-foreground">Atur urutan learner dengan panah di setiap elemen.</p></div><Badge variant="outline">{contentBlocks.length} elemen</Badge></div><div className="space-y-3">{contentBlocks.map((block, index) => <ContentBlockCard key={block.id} block={block} index={index} total={contentBlocks.length} onChange={(patch) => updateContentBlock(index, patch)} onMove={moveContentBlock} onRemove={requestRemoveContentBlock} />)}</div></section>}
    <section className="rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange"><AapmIcon name="solar:play-circle-bold" className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Video pembelajaran</p><h3 className="mt-1 text-base font-semibold">Tambahkan video sebagai kartu terpisah</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Video tetap punya urutan sendiri, tanpa mengganggu alur tulisan dan elemen materi.</p></div></div><Button type="button" size="sm" variant="outline" onClick={addVideo}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah video</Button></div>{videos.length ? <div className="mt-4 space-y-3">{videos.map((video, index) => <VideoCard key={video.id} block={video} index={index} total={videos.length} onChange={(patch) => updateVideo(index, patch)} onMove={moveVideo} onRemove={requestRemoveVideo} />)}</div> : <div className="mt-4 rounded-xl border border-dashed border-brand-orange/25 bg-background/70 px-4 py-5 text-center text-xs leading-5 text-muted-foreground">Belum ada video. Tambahkan hanya jika modul ini memiliki materi video.</div>}</section>
    <ConfirmDialog open={Boolean(pendingContentBlockDelete)} onOpenChange={(open) => !open && setPendingContentBlockDelete(null)} title="Hapus elemen materi?" description={`${pendingContentBlockDelete?.label || "Elemen"} akan dihapus dari alur learner. Perubahan baru tersimpan setelah Anda menekan Simpan modul.`} confirmLabel="Hapus elemen" cancelLabel="Batal" icon="solar:trash-bin-trash-bold" destructive onConfirm={removeContentBlock} />
    <ConfirmDialog open={Boolean(pendingVideoDelete)} onOpenChange={(open) => !open && setPendingVideoDelete(null)} title="Hapus video?" description={`Video ${pendingVideoDelete ? pendingVideoDelete.index + 1 : ""} akan dihapus dari modul. Perubahan baru tersimpan setelah Anda menekan Simpan modul.`} confirmLabel="Hapus video" cancelLabel="Batal" icon="solar:trash-bin-trash-bold" destructive onConfirm={removeVideo} />
  </div>;
}
