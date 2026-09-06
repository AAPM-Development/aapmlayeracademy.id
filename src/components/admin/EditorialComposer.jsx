// @ts-nocheck
import React from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import AapmIcon from "@/components/icons/AapmIcon";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  Badge,
  Button,
  Checkbox,
  IconButton,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/primitives";
import { cn } from "@/lib/utils";
import { nativeApi } from "@/api/nativeClient";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import {
  createEditorialBlock,
  createEditorialDocument,
  createEditorialSlide,
  EDITORIAL_TEXT_LIMIT,
  editorialBlockLibrary,
  editorialTextLength,
  ensureEditorialDocument,
} from "@/lib/editorialDocument";

const blockMeta = Object.fromEntries(editorialBlockLibrary.map((item) => [item.type, item]));

function Field({ label, children, hint = "", id, error = "" }) {
  const descriptionId = id && (hint || error) ? `${id}-description` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
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

const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_PRESENTATION_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_PRESENTATION_SLIDES = 50;
const imageExtensions = /\.(?:jpe?g|png|gif|webp|avif)$/i;
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

function readableBytes(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function decodedInternalPath(value) {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return "";
    }
  }
  return decoded;
}

function editorialImageUrlIssue(value) {
  const source = value.trim();
  if (!source) return "";
  if (source.startsWith("/")) {
    const decoded = decodedInternalPath(source);
    const pathname = source.split(/[?#]/, 1)[0];
    if (!decoded || source.startsWith("//") || /[\\\x00-\x1F\x7F]/.test(decoded) || /(?:^|\/)\.\.?(?:\/|$)/.test(decoded)) {
      return "Path internal tidak aman.";
    }
    if (!/^\/(?:assets|media|uploads)(?:\/|$)/.test(pathname) || !imageExtensions.test(pathname)) {
      return "Gunakan gambar PNG, JPG, WebP, AVIF, atau GIF pada /assets/, /media/, atau /uploads/.";
    }
    return "";
  }
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return "URL gambar harus HTTPS tanpa kredensial.";
    }
    if (!imageExtensions.test(url.pathname)) {
      return "URL gambar harus berakhiran PNG, JPG, WebP, AVIF, atau GIF.";
    }
    return "";
  } catch {
    return "Masukkan URL HTTPS gambar yang valid atau unggah berkas.";
  }
}

function imageFileIssue(file) {
  if (!file) return "";
  const filenameAllowed = imageExtensions.test(file.name || "");
  if (!filenameAllowed || (file.type && !imageMimeTypes.has(file.type))) {
    return "Pilih gambar JPG, PNG, GIF, WebP, atau AVIF.";
  }
  if (file.size < 1 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return `Ukuran gambar maksimal ${readableBytes(MAX_IMAGE_UPLOAD_BYTES)}.`;
  }
  return "";
}

function SourceImagePreview({ src, alt }) {
  const [failed, setFailed] = React.useState(false);
  const issue = editorialImageUrlIssue(src || "");

  React.useEffect(() => setFailed(false), [src]);

  if (!src || issue) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-subtle">
      {failed ? (
        <p className="p-3 text-xs leading-5 text-danger" role="alert">Pratinjau tidak dapat dimuat. Periksa URL atau gunakan unggah gambar.</p>
      ) : (
        <img src={src} alt={alt || ""} className="aspect-video w-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function ImageSourceField({ id, value, onValueChange, alt = "", label = "Gambar / GIF", hint }) {
  const [uploadState, setUploadState] = React.useState({ status: "idle", message: "" });
  const sourceIssue = editorialImageUrlIssue(value || "");
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
      setUploadState({ status: "success", message: "Gambar siap dipakai dalam modul." });
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
          placeholder="https://cdn.example.com/observasi-kandang.gif"
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
    <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2.5">
      <Checkbox id={id} checked={Boolean(decorative)} onCheckedChange={(checked) => onChange(Boolean(checked))} className="mt-0.5 h-4 w-4" />
      <Label htmlFor={id} className="cursor-pointer text-xs font-medium leading-5">Gambar dekoratif <span className="font-normal text-muted-foreground">— alt text tidak diperlukan karena tidak membawa informasi.</span></Label>
    </div>
  );
}

function parseDelimitedTable(rawText) {
  const source = String(rawText || "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? "\t" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("Tanda petik CSV belum ditutup.");
  row.push(cell);
  rows.push(row);

  const meaningfulRows = rows.filter((item) => item.some((value) => String(value).trim() !== ""));
  if (!meaningfulRows.length) throw new Error("Berkas tabel tidak memiliki data yang dapat diimpor.");
  const columns = meaningfulRows[0]
    .slice(0, 8)
    .map((value, index) => String(value).trim().slice(0, 160) || `Kolom ${index + 1}`);
  if (!columns.length) throw new Error("Header tabel tidak ditemukan.");
  const dataRows = meaningfulRows.slice(1, 21).map((item) =>
    columns.map((_, index) => String(item[index] || "").slice(0, 3000)),
  );
  return { columns, rows: dataRows.length ? dataRows : [columns.map(() => "")] };
}

function TableBlockFields({ block, onChange }) {
  const columns = Array.isArray(block.columns) ? block.columns : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const tableScrollRef = useScrollEdgeFade();
  const [pendingImport, setPendingImport] = React.useState(null);
  const [importMessage, setImportMessage] = React.useState("");
  const importId = `${block.id}-table-import`;
  const setColumns = (nextColumns) => {
    onChange({
      columns: nextColumns,
      rows: rows.map((row) => nextColumns.map((_, index) => row?.[index] || "")),
    });
  };
  const updateRow = (rowIndex, columnIndex, value) => {
    onChange({
      rows: rows.map((row, currentRow) => currentRow === rowIndex ? row.map((cell, currentColumn) => currentColumn === columnIndex ? value : cell) : row),
    });
  };
  const applyImport = (nextTable) => {
    onChange(nextTable);
    setPendingImport(null);
    setImportMessage(`Tabel diimpor: ${nextTable.columns.length} kolom dan ${nextTable.rows.length} baris.`);
  };
  const importTable = async (file) => {
    if (!file) return;
    if (!/\.(?:csv|tsv)$/i.test(file.name || "") || file.size > 512 * 1024) {
      setImportMessage("Pilih berkas CSV atau TSV berukuran maksimal 512 KB.");
      return;
    }
    try {
      const nextTable = parseDelimitedTable(await file.text());
      const hasExistingData = columns.some((item) => item.trim()) || rows.some((row) => row.some((cell) => String(cell).trim()));
      if (hasExistingData) {
        setPendingImport(nextTable);
        setImportMessage("Tabel saat ini akan diganti setelah Anda mengonfirmasi impor.");
      } else {
        applyImport(nextTable);
      }
    } catch (error) {
      setImportMessage(error?.message || "Tabel tidak dapat dibaca.");
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Judul tabel (opsional)">
        <Input value={block.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Contoh: Target pemeriksaan harian" />
      </Field>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold">Struktur tabel</div>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Maks. 8 kolom, 20 baris; tabel tetap bisa digeser di layar kecil.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={columns.length >= 8} onClick={() => setColumns([...columns, `Kolom ${columns.length + 1}`])}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah kolom</Button>
          <Button type="button" size="sm" variant="outline" disabled={columns.length <= 1} onClick={() => {
            if (window.confirm("Hapus kolom terakhir beserta isinya?")) setColumns(columns.slice(0, -1));
          }}><AapmIcon name="minus" className="h-3.5 w-3.5" />Kurangi kolom</Button>
          <input id={importId} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="sr-only" onChange={(event) => {
            const [file] = event.target.files || [];
            event.target.value = "";
            if (file) void importTable(file);
          }} />
          <Button asChild type="button" size="sm" variant="outline"><label htmlFor={importId} className="cursor-pointer"><AapmIcon name="fileCheck" className="h-3.5 w-3.5" />Impor CSV/TSV</label></Button>
        </div>
      </div>
      {pendingImport && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-orange/25 bg-brand-orange/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5">Impor baru akan mengganti seluruh data tabel saat ini.</p>
          <div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => applyImport(pendingImport)}>Ganti dengan impor</Button><Button type="button" size="sm" variant="outline" onClick={() => setPendingImport(null)}>Batal</Button></div>
        </div>
      )}
      {importMessage && <p className="text-[11px] leading-5 text-muted-foreground" role="status">{importMessage}</p>}
      <div ref={tableScrollRef} className="aapm-scroll-fade aapm-scroll-fade--x aapm-scrollbar max-w-full overflow-x-auto rounded-xl border border-border bg-background" tabIndex={0} aria-label="Editor tabel. Geser horizontal untuk melihat semua kolom.">
        <div className="min-w-[38rem] space-y-3 p-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(11rem, 1fr))` }}>
            {columns.map((column, index) => (
              <Field key={`column-${index}`} label={`Kolom ${index + 1}`}>
                <Input value={column} maxLength={160} onChange={(event) => setColumns(columns.map((item, currentIndex) => currentIndex === index ? event.target.value : item))} />
              </Field>
            ))}
          </div>
          <div className="space-y-3 border-t border-border pt-3">
            {rows.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">Baris {rowIndex + 1}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Naikkan baris ${rowIndex + 1}`} tooltip="Naikkan baris satu posisi" disabled={rowIndex === 0} onClick={() => onChange({ rows: moveInList(rows, rowIndex, rowIndex - 1) })}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton>
                    <IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Turunkan baris ${rowIndex + 1}`} tooltip="Turunkan baris satu posisi" disabled={rowIndex === rows.length - 1} onClick={() => onChange({ rows: moveInList(rows, rowIndex, rowIndex + 1) })}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton>
                    <IconButton size="sm" className="h-10 w-10 p-0 text-danger hover:bg-danger/5 hover:text-danger sm:h-8 sm:w-8" label={`Hapus baris ${rowIndex + 1}`} tooltip="Hapus baris" disabled={rows.length <= 1} onClick={() => {
                      if (window.confirm(`Hapus Baris ${rowIndex + 1}?`)) onChange({ rows: rows.filter((_, currentIndex) => currentIndex !== rowIndex) });
                    }}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton>
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(11rem, 1fr))` }}>
                  {columns.map((column, columnIndex) => (
                    <Field key={`row-${rowIndex}-column-${columnIndex}`} label={column || `Kolom ${columnIndex + 1}`}>
                      <Textarea rows={1} className="min-h-11 resize-y" maxLength={3000} value={row?.[columnIndex] || ""} onChange={(event) => updateRow(rowIndex, columnIndex, event.target.value)} />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" className="w-full" disabled={rows.length >= 20} onClick={() => onChange({ rows: [...rows, columns.map(() => "")] })}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah baris</Button>
        </div>
      </div>
    </div>
  );
}

function SlidesBlockFields({ block, onChange }) {
  const source = block.source === "pptx" ? "pptx" : "manual";
  const slides = Array.isArray(block.slides) ? block.slides : [];
  const [uploadState, setUploadState] = React.useState({ status: "idle", message: "" });
  const [pendingPresentation, setPendingPresentation] = React.useState(null);
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
    if (source === "pptx" && !window.confirm("Kembali ke slide manual? Referensi PPTX pada blok ini akan dilepas.")) return;
    onChange({ source: "manual", pptxUrl: "", pptxName: "", slideCount: 0, slides: slides.length ? slides : [createEditorialSlide(1)] });
  };
  return (
    <div className="space-y-3">
      <Field id={`${block.id}-slides-title`} label="Judul rangkaian slide (opsional)">
        <Input id={`${block.id}-slides-title`} value={block.title} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="Contoh: Alur pemeriksaan kandang" />
      </Field>
      <div className="rounded-xl border border-border bg-surface-subtle p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold">Cara membuat slide</div>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Manual atau PPTX; learner menampilkannya sebagai carousel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={source === "manual" ? "default" : "outline"} onClick={switchToManual}><AapmIcon name="edit" className="h-3.5 w-3.5" />Manual</Button>
            <input id={presentationInputId} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="sr-only" disabled={uploadState.status === "loading"} onChange={(event) => {
              const [file] = event.target.files || [];
              event.target.value = "";
              if (file) choosePresentation(file);
            }} />
            <Button asChild type="button" size="sm" variant={source === "pptx" ? "default" : "outline"} disabled={uploadState.status === "loading"}><label htmlFor={presentationInputId} className="cursor-pointer"><AapmIcon name="fileCheck" className="h-3.5 w-3.5" />{source === "pptx" ? "Ganti PPTX" : "Unggah PPTX"}</label></Button>
          </div>
        </div>
      </div>
      {pendingPresentation && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-orange/25 bg-brand-orange/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5">PPTX akan menggantikan {slides.length} slide manual di blok ini.</p>
          <div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void uploadPresentationFile(pendingPresentation)}>Gunakan PPTX</Button><Button type="button" size="sm" variant="outline" onClick={() => setPendingPresentation(null)}>Batal</Button></div>
        </div>
      )}
      {uploadState.status !== "idle" && <p className={cn("text-[10px] leading-4", uploadState.status === "error" ? "text-danger" : uploadState.status === "success" ? "text-brand-green" : "text-muted-foreground")} role={uploadState.status === "error" ? "alert" : "status"}>{uploadState.message}</p>}
      {source === "pptx" ? (
        <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><AapmIcon name="fileCheck" className="h-4 w-4 text-brand-orange" /><span className="text-sm font-semibold">{block.pptxName || "Presentasi PowerPoint"}</span></div>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{block.slideCount || 0} slide · carousel learner responsif.</p>
            </div>
            <Badge variant="soft" className="bg-tint-green text-brand-green">PPTX terkelola</Badge>
          </div>
          <p className="mt-3 rounded-lg bg-surface-subtle px-3 py-2 text-[10px] leading-4 text-muted-foreground">1–{MAX_PRESENTATION_SLIDES} slide · maks. 50 MB · gunakan .pptx dengan media tertanam.</p>
        </div>
      ) : (
        <>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold">Rangkaian slide manual</div>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Setiap slide dapat berisi gambar dan teks.</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={slides.length >= 12} onClick={() => onChange({ slides: [...slides, createEditorialSlide(slides.length + 1)] })}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah slide</Button>
      </div>
      <div className="space-y-3">
        {slides.map((slide, index) => (
          <article key={slide.id} className="rounded-xl border border-border bg-background p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="text-xs font-semibold">Slide {index + 1} dari {slides.length}</span>
              <div className="flex flex-wrap gap-1.5">
                <IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Naikkan slide ${index + 1}`} tooltip="Naikkan slide satu posisi" disabled={index === 0} onClick={() => onChange({ slides: moveInList(slides, index, index - 1) })}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton>
                <IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Turunkan slide ${index + 1}`} tooltip="Turunkan slide satu posisi" disabled={index === slides.length - 1} onClick={() => onChange({ slides: moveInList(slides, index, index + 1) })}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton>
                <IconButton size="sm" className="h-10 w-10 p-0 text-danger hover:bg-danger/5 hover:text-danger sm:h-8 sm:w-8" label={`Hapus slide ${index + 1}`} tooltip="Hapus slide" disabled={slides.length <= 1} onClick={() => {
                  if (window.confirm(`Hapus Slide ${index + 1}?`)) onChange({ slides: slides.filter((_, currentIndex) => currentIndex !== index) });
                }}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Field id={`${block.id}-slide-${index}-title`} label="Judul slide">
                <Input id={`${block.id}-slide-${index}-title`} value={slide.title} maxLength={180} onChange={(event) => updateSlide(index, { title: event.target.value })} />
              </Field>
              <div className="lg:col-span-2"><ImageSourceField id={`${block.id}-slide-${index}-image`} label="Gambar slide (opsional)" value={slide.src || ""} alt={slide.alt || ""} onValueChange={(src) => updateSlide(index, { src })} hint="Pilih gambar slide dari komputer atau masukkan URL HTTPS." /></div>
              <div className="lg:col-span-2">
                <Field id={`${block.id}-slide-${index}-content`} label="Isi slide (opsional)">
                  <Textarea id={`${block.id}-slide-${index}-content`} rows={3} maxLength={3000} value={slide.content} onChange={(event) => updateSlide(index, { content: event.target.value })} />
                </Field>
              </div>
              {slide.src && <div className="lg:col-span-2 space-y-3"><DecorativeImageControl id={`${block.id}-slide-${index}-decorative`} decorative={slide.decorative !== false} onChange={(decorative) => updateSlide(index, { decorative })} />{slide.decorative === false && <Field id={`${block.id}-slide-${index}-alt`} label="Alt text gambar" hint="Wajib untuk gambar yang membawa informasi."><Input id={`${block.id}-slide-${index}-alt`} value={slide.alt || ""} maxLength={280} onChange={(event) => updateSlide(index, { alt: event.target.value })} /></Field>}</div>}
            </div>
          </article>
        ))}
      </div>
        </>
      )}
    </div>
  );
}

function BlockFields({ block, onChange }) {
  const set = (field, value) => onChange({ [field]: value });
  const fieldId = (field) => `${block.id}-${field}`;

  switch (block.type) {
    case "richText":
      return (
        <Field
          label="Materi"
          hint="Editor menyimpan Markdown aman agar modul lama tetap terbaca. HTML, script, dan iframe dibersihkan; gunakan tautan HTTPS atau path internal."
          id={fieldId("content")}
        >
          <RichTextEditor
            id={fieldId("content")}
            value={block.content}
            onChange={(content) => set("content", content)}
          />
        </Field>
      );
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Teks judul">
            <Input value={block.content} onChange={(event) => set("content", event.target.value)} />
          </Field>
          <Field label="Tingkat">
            <Select value={String(block.level)} onValueChange={(value) => set("level", Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Judul utama</SelectItem>
                <SelectItem value="3">Subbagian</SelectItem>
                <SelectItem value="4">Detail</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    case "table":
      return <TableBlockFields block={block} onChange={onChange} />;
    case "image":
      return (
        <div className="space-y-3">
          <ImageSourceField id={fieldId("image-source")} value={block.src || ""} alt={block.alt || ""} onValueChange={(src) => set("src", src)} />
          {block.src && <DecorativeImageControl id={fieldId("image-decorative")} decorative={block.decorative !== false} onChange={(decorative) => set("decorative", decorative)} />}
          <div className="grid gap-3 sm:grid-cols-2">
            {block.decorative === false && <Field id={fieldId("image-alt")} label="Alt text" hint="Wajib untuk gambar yang membawa informasi."><Input id={fieldId("image-alt")} value={block.alt} onChange={(event) => set("alt", event.target.value)} placeholder="Deskripsi gambar untuk aksesibilitas" /></Field>}
            <Field label="Keterangan (opsional)">
              <Input value={block.caption} onChange={(event) => set("caption", event.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rasio tampilan">
              <Select value={block.ratio} onValueChange={(value) => set("ratio", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Rasio asli</SelectItem>
                  <SelectItem value="wide">16:9</SelectItem>
                  <SelectItem value="standard">4:3</SelectItem>
                  <SelectItem value="square">1:1</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lebar pada desktop">
              <Select value={block.width} onValueChange={(value) => set("width", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standar</SelectItem>
                  <SelectItem value="wide">Lebar</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      );
    case "slides":
      return <SlidesBlockFields block={block} onChange={onChange} />;
    case "video":
      return (
        <div className="space-y-3">
          <Field label="Tautan video" hint="Hanya YouTube, Vimeo, file HTTPS, atau file internal pada /assets/, /media/, /uploads/ yang dapat dipublikasikan.">
            <Input type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://youtu.be/... atau /media/lesson-01.mp4" value={block.url} onChange={(event) => set("url", event.target.value)} />
          </Field>
          <Field label="Keterangan (opsional)">
            <Textarea rows={2} value={block.caption} onChange={(event) => set("caption", event.target.value)} />
          </Field>
        </div>
      );
    case "link":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label tautan">
            <Input value={block.label} onChange={(event) => set("label", event.target.value)} />
          </Field>
          <Field label="URL HTTPS / internal">
            <Input type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." value={block.url} onChange={(event) => set("url", event.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Konteks (opsional)">
              <Textarea rows={2} value={block.description} onChange={(event) => set("description", event.target.value)} />
            </Field>
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
          <Field label="Label tombol">
            <Input value={block.label} onChange={(event) => set("label", event.target.value)} />
          </Field>
          <Field label="URL HTTPS / internal">
            <Input type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." value={block.url} onChange={(event) => set("url", event.target.value)} />
          </Field>
          <Field label="Gaya">
            <Select value={block.variant} onValueChange={(value) => set("variant", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Utama</SelectItem>
                <SelectItem value="secondary">Sekunder</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    case "callout":
      return (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="space-y-3">
            <Field label="Judul">
              <Input value={block.title} onChange={(event) => set("title", event.target.value)} />
            </Field>
            <Field label="Isi sorotan">
              <Textarea rows={3} value={block.content} onChange={(event) => set("content", event.target.value)} />
            </Field>
          </div>
          <Field label="Nada">
            <Select value={block.tone} onValueChange={(value) => set("tone", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Informasi</SelectItem>
                <SelectItem value="practice">Praktik</SelectItem>
                <SelectItem value="warning">Perhatian</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    case "divider":
      return <p className="text-sm leading-6 text-muted-foreground">Pemisah tidak memerlukan konfigurasi dan akan selalu mengikuti lebar materi.</p>;
    default:
      return null;
  }
}

function blockLayoutClass(type) {
  return ["richText", "image", "video", "table", "slides"].includes(type) ? "lg:col-span-2" : "";
}

function BlockCard({ block, index, total, onChange, onMove, onRemove, dragHandleProps, draggableProps, innerRef, isDragging }) {
  const meta = blockMeta[block.type];
  return (
    <article
      ref={innerRef}
      {...draggableProps}
      className={cn(
        "rounded-xl border border-border bg-background p-3 shadow-sm transition-shadow sm:p-4",
        blockLayoutClass(block.type),
        isDragging && "shadow-lg ring-2 ring-brand-orange/25",
      )}
    >
      <div className="mb-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={`Seret blok ${meta?.label || block.type} untuk mengubah urutan`}
            title="Seret untuk mengubah urutan"
            className="mt-0.5 inline-flex h-10 shrink-0 cursor-grab items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing sm:h-8"
            {...dragHandleProps}
          >
            <AapmIcon name="grip" className="h-4 w-4" />
            <span>Seret</span>
          </button>
          <Badge variant="outline" title={meta?.description} className="shrink-0 whitespace-nowrap border-brand-orange/25 bg-brand-orange/5 text-brand-orange">{meta?.label || block.type}</Badge>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Urutan learner {index + 1}/{total}</span>
          {total > 1 && (
            <Select value={String(index + 1)} onValueChange={(value) => onMove(index, Number(value) - 1)}>
              <SelectTrigger className="h-10 w-36 shrink-0 text-[11px] sm:h-8" aria-label={`Atur urutan tampil learner untuk ${meta?.label || block.type}`}>
                <SelectValue placeholder="Ubah urutan" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: total }, (_, optionIndex) => (
                  <SelectItem key={optionIndex} value={String(optionIndex + 1)}>Urutan learner {optionIndex + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex items-center gap-1">
            <div role="group" aria-label={`Pindahkan ${meta?.label || block.type} satu posisi`} className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 shadow-sm">
              <IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Naikkan ${meta?.label || block.type}`} tooltip="Naikkan satu posisi" disabled={index === 0} onClick={() => onMove(index, index - 1)}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" /></IconButton>
              <IconButton size="sm" className="h-10 w-10 p-0 sm:h-8 sm:w-8" label={`Turunkan ${meta?.label || block.type}`} tooltip="Turunkan satu posisi" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}><AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></IconButton>
            </div>
            <IconButton size="sm" className="h-10 w-10 p-0 text-danger hover:bg-danger/5 hover:text-danger sm:h-8 sm:w-8" label={`Hapus ${meta?.label || block.type}`} tooltip="Hapus blok" onClick={() => onRemove(index)}><AapmIcon name="delete" className="h-3.5 w-3.5" /></IconButton>
          </div>
        </div>
      </div>
      <BlockFields block={block} onChange={onChange} />
    </article>
  );
}

export default function EditorialComposer({ value, onChange }) {
  const document = ensureEditorialDocument(value);
  const blocks = document.blocks;
  const textLength = editorialTextLength(blocks);
  const [announcement, setAnnouncement] = React.useState("");
  const commit = (nextBlocks) => {
    if (editorialTextLength(nextBlocks) > EDITORIAL_TEXT_LIMIT) return;
    onChange(createEditorialDocument(nextBlocks));
  };
  const addBlock = (type) => {
    const block = createEditorialBlock(type);
    if (block && blocks.length < 80) commit([...blocks, block]);
  };
  const updateBlock = (index, patch) => {
    commit(blocks.map((block, currentIndex) => currentIndex === index ? { ...block, ...patch } : block));
  };
  const moveBlock = (sourceIndex, destinationIndex) => {
    if (destinationIndex < 0 || destinationIndex >= blocks.length || sourceIndex === destinationIndex) return;
    const next = [...blocks];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(destinationIndex, 0, moved);
    commit(next);
    setAnnouncement(`${blockMeta[moved?.type]?.label || "Blok"} dipindahkan ke posisi ${destinationIndex + 1} dari ${blocks.length}.`);
  };
  const removeBlock = (index) => {
    const block = blocks[index];
    if (!block || !window.confirm(`Hapus blok ${blockMeta[block.type]?.label || "ini"} beserta seluruh isinya?`)) return;
    commit(blocks.filter((_, currentIndex) => currentIndex !== index));
    setAnnouncement(`${blockMeta[block.type]?.label || "Blok"} dihapus.`);
  };
  const onDragEnd = (result) => {
    if (!result.destination) return;
    moveBlock(result.source.index, result.destination.index);
  };

  return (
    <div className="space-y-4">
      <div className="sr-only" aria-live="polite">{announcement}</div>
      <div className="rounded-xl border border-border bg-surface-subtle p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Kanvas editorial</div>
            <h3 className="mt-1 text-sm font-semibold">Susun materi sebagai blok yang aman</h3>
            <p className="mt-1 max-w-2xl text-[10px] leading-4 text-muted-foreground">Urutan learner mengikuti posisi blok. Seret, pilih nomor, atau gunakan ikon panah.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="soft" className="w-fit bg-tint-green text-brand-green">{blocks.length}/80 blok</Badge>
            <Badge variant="outline" className="w-fit">{textLength.toLocaleString("id-ID")}/{EDITORIAL_TEXT_LIMIT.toLocaleString("id-ID")} byte teks</Badge>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {editorialBlockLibrary.map((item) => (
            <Button key={item.type} type="button" variant="outline" aria-label={`Tambah blok ${item.label}`} title={`Tambah blok ${item.label}`} className="h-9 justify-start gap-2 px-2.5 text-left text-xs" disabled={blocks.length >= 80} onClick={() => addBlock(item.type)}>
              <AapmIcon name={item.icon} className="shrink-0 text-brand-orange" />
              <span className="min-w-0 truncate font-semibold">{item.label}</span>
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Batas teks diterapkan saat mengetik; media tetap responsif dan HTML bebas tidak diterbitkan.</p>
      </div>

      {blocks.length ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="editorial-blocks">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="grid items-start gap-3 lg:grid-cols-2">
                {blocks.map((block, index) => (
                  <Draggable key={block.id} draggableId={block.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <BlockCard
                        block={block}
                        index={index}
                        total={blocks.length}
                        onChange={(patch) => updateBlock(index, patch)}
                        onMove={moveBlock}
                        onRemove={removeBlock}
                        innerRef={dragProvided.innerRef}
                        draggableProps={dragProvided.draggableProps}
                        dragHandleProps={dragProvided.dragHandleProps}
                        isDragging={snapshot.isDragging}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm leading-6 text-muted-foreground">Belum ada blok editorial. Konten Markdown lama tetap dipakai sampai Anda menambahkan blok pertama.</div>
      )}
    </div>
  );
}
