// @ts-nocheck
import React from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import AapmIcon from "@/components/icons/AapmIcon";
import {
  Badge,
  Button,
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

function Field({ label, children, hint = "" }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-5 text-muted-foreground">{hint}</p>}
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

function TableBlockFields({ block, onChange }) {
  const columns = Array.isArray(block.columns) ? block.columns : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
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

  return (
    <div className="space-y-4">
      <Field label="Judul tabel (opsional)">
        <Input value={block.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Contoh: Target pemeriksaan harian" />
      </Field>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold">Struktur tabel</div>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">Maksimal 8 kolom dan 20 baris. Learner dapat menggeser tabel secara horizontal pada layar kecil.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={columns.length >= 8} onClick={() => setColumns([...columns, `Kolom ${columns.length + 1}`])}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah kolom</Button>
          <Button type="button" size="sm" variant="outline" disabled={columns.length <= 1} onClick={() => setColumns(columns.slice(0, -1))}><AapmIcon name="minus" className="h-3.5 w-3.5" />Kurangi kolom</Button>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl border border-border bg-background">
        <div className="min-w-[42rem] space-y-3 p-3">
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
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={rowIndex === 0} onClick={() => onChange({ rows: moveInList(rows, rowIndex, rowIndex - 1) })}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" />Naik</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={rowIndex === rows.length - 1} onClick={() => onChange({ rows: moveInList(rows, rowIndex, rowIndex + 1) })}>Turun<AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-danger hover:bg-danger/5 hover:text-danger" disabled={rows.length <= 1} onClick={() => onChange({ rows: rows.filter((_, currentIndex) => currentIndex !== rowIndex) })}><AapmIcon name="delete" className="h-3.5 w-3.5" />Hapus</Button>
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(11rem, 1fr))` }}>
                  {columns.map((column, columnIndex) => (
                    <Field key={`row-${rowIndex}-column-${columnIndex}`} label={column || `Kolom ${columnIndex + 1}`}>
                      <Textarea rows={2} maxLength={3000} value={row?.[columnIndex] || ""} onChange={(event) => updateRow(rowIndex, columnIndex, event.target.value)} />
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
  const slides = Array.isArray(block.slides) ? block.slides : [];
  const updateSlide = (index, patch) => onChange({ slides: slides.map((slide, currentIndex) => currentIndex === index ? { ...slide, ...patch } : slide) });
  return (
    <div className="space-y-4">
      <Field label="Judul rangkaian slide (opsional)">
        <Input value={block.title} maxLength={160} onChange={(event) => onChange({ title: event.target.value })} placeholder="Contoh: Alur pemeriksaan kandang" />
      </Field>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold">Rangkaian slide</div>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">Setiap slide dapat berupa gambar, teks, atau keduanya. Navigasi learner tetap satu kolom dan responsif.</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={slides.length >= 12} onClick={() => onChange({ slides: [...slides, createEditorialSlide(slides.length + 1)] })}><AapmIcon name="add" className="h-3.5 w-3.5" />Tambah slide</Button>
      </div>
      <div className="space-y-3">
        {slides.map((slide, index) => (
          <article key={slide.id} className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <span className="text-xs font-semibold">Slide {index + 1} dari {slides.length}</span>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={index === 0} onClick={() => onChange({ slides: moveInList(slides, index, index - 1) })}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" />Naik</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={index === slides.length - 1} onClick={() => onChange({ slides: moveInList(slides, index, index + 1) })}>Turun<AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-danger hover:bg-danger/5 hover:text-danger" disabled={slides.length <= 1} onClick={() => onChange({ slides: slides.filter((_, currentIndex) => currentIndex !== index) })}><AapmIcon name="delete" className="h-3.5 w-3.5" />Hapus</Button>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Judul slide">
                <Input value={slide.title} maxLength={180} onChange={(event) => updateSlide(index, { title: event.target.value })} />
              </Field>
              <Field label="URL gambar (opsional)" hint="Gunakan HTTPS atau /assets/, /media/, /uploads/; SVG dan data URL ditolak.">
                <Input type="text" inputMode="url" autoCapitalize="off" spellCheck={false} value={slide.src} onChange={(event) => updateSlide(index, { src: event.target.value })} placeholder="https://cdn.example.com/slide-01.png" />
              </Field>
              <div className="lg:col-span-2">
                <Field label="Isi slide (opsional)">
                  <Textarea rows={3} maxLength={3000} value={slide.content} onChange={(event) => updateSlide(index, { content: event.target.value })} />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Field label="Alt text gambar (opsional)">
                  <Input value={slide.alt} maxLength={280} onChange={(event) => updateSlide(index, { alt: event.target.value })} />
                </Field>
              </div>
            </div>
          </article>
        ))}
      </div>
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
          hint="Mendukung Markdown aman: **tebal**, *miring*, daftar, kutipan, tabel, dan [tautan](https://...). HTML, script, dan iframe tidak diterbitkan."
        >
          <Textarea
            id={fieldId("content")}
            rows={9}
            value={block.content}
            onChange={(event) => set("content", event.target.value)}
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
          <Field label="URL gambar / GIF" hint="Gunakan HTTPS atau path internal /assets/, /media/, /uploads/. SVG dan data URL ditolak demi keamanan.">
            <Input type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://cdn.example.com/observasi-kandang.gif" value={block.src} onChange={(event) => set("src", event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Alt text">
              <Input value={block.alt} onChange={(event) => set("alt", event.target.value)} placeholder="Deskripsi gambar untuk aksesibilitas" />
            </Field>
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

function BlockCard({ block, index, total, onChange, onMove, onRemove, dragHandleProps, draggableProps, innerRef, isDragging }) {
  const meta = blockMeta[block.type];
  return (
    <article
      ref={innerRef}
      {...draggableProps}
      className={cn(
        "rounded-xl border border-border bg-background p-4 shadow-sm transition-shadow",
        isDragging && "shadow-lg ring-2 ring-brand-orange/25",
      )}
    >
      <div className="mb-4 flex min-w-0 flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            aria-label={`Seret blok ${meta?.label || block.type} untuk mengubah urutan`}
            title="Seret untuk mengubah urutan"
            className="mt-0.5 inline-flex h-8 shrink-0 cursor-grab items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
            {...dragHandleProps}
          >
            <AapmIcon name="grip" className="h-4 w-4" />
            <span>Seret</span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-brand-orange/25 bg-brand-orange/5 text-brand-orange">{meta?.label || block.type}</Badge>
              <span className="text-[11px] text-muted-foreground">Posisi {index + 1} dari {total}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{meta?.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="text-[11px] font-medium text-muted-foreground">Pindahkan</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-background shadow-sm">
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-none px-2 text-xs" title="Naik satu posisi" disabled={index === 0} onClick={() => onMove(index, index - 1)}><AapmIcon name="chevronUp" className="h-3.5 w-3.5" />Naik</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-none border-l border-border px-2 text-xs" title="Turun satu posisi" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>Turun<AapmIcon name="chevronDown" className="h-3.5 w-3.5" /></Button>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-danger/20 px-2 text-xs text-danger hover:bg-danger/5 hover:text-danger" onClick={() => onRemove(index)}><AapmIcon name="delete" className="h-3.5 w-3.5" />Hapus</Button>
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
  };
  const removeBlock = (index) => commit(blocks.filter((_, currentIndex) => currentIndex !== index));
  const onDragEnd = (result) => {
    if (!result.destination) return;
    moveBlock(result.source.index, result.destination.index);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface-subtle p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Kanvas editorial</div>
            <h3 className="mt-1 text-sm font-semibold">Susun materi sebagai blok yang aman</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Drag untuk mengubah urutan atau gunakan panah. Semua media dipaksa tetap responsif pada viewport learner; HTML, CSS, dan iframe bebas tidak pernah dipublikasikan.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="soft" className="w-fit bg-tint-green text-brand-green">{blocks.length}/80 blok</Badge>
            <Badge variant="outline" className="w-fit">{textLength.toLocaleString("id-ID")}/{EDITORIAL_TEXT_LIMIT.toLocaleString("id-ID")} byte teks</Badge>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Batas teks diterapkan saat Anda mengetik agar isi yang dirangkai di sini selalu bisa disimpan oleh server.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {editorialBlockLibrary.map((item) => (
            <Button key={item.type} type="button" variant="outline" className="h-auto min-h-12 justify-start whitespace-normal px-3 py-2.5 text-left" disabled={blocks.length >= 80} onClick={() => addBlock(item.type)}>
              <AapmIcon name={item.icon} className="shrink-0 text-brand-orange" />
              <span className="min-w-0"><span className="block text-xs font-semibold">{item.label}</span><span className="mt-0.5 block text-[10px] font-normal leading-4 text-muted-foreground">Tambah blok</span></span>
            </Button>
          ))}
        </div>
      </div>

      {blocks.length ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="editorial-blocks">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
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
