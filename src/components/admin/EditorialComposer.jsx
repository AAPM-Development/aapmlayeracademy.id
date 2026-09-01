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
  editorialBlockLibrary,
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
    case "image":
      return (
        <div className="space-y-3">
          <Field label="URL gambar / GIF" hint="Gunakan HTTPS atau path internal seperti /assets/... . SVG dan data URL ditolak demi keamanan.">
            <Input type="url" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://cdn.example.com/observasi-kandang.gif" value={block.src} onChange={(event) => set("src", event.target.value)} />
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
    case "video":
      return (
        <div className="space-y-3">
          <Field label="Tautan video" hint="Hanya YouTube, Vimeo, atau path/file video internal HTTPS yang dapat dipublikasikan.">
            <Input type="url" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://youtu.be/... atau /media/lesson-01.mp4" value={block.url} onChange={(event) => set("url", event.target.value)} />
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
            <Input type="url" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." value={block.url} onChange={(event) => set("url", event.target.value)} />
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
            <Input type="url" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="https://..." value={block.url} onChange={(event) => set("url", event.target.value)} />
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
      <div className="mb-4 flex min-w-0 items-start gap-2">
        <button
          type="button"
          aria-label={`Seret blok ${meta?.label || block.type}`}
          className="mt-1 cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...dragHandleProps}
        >
          <AapmIcon name="solar:hamburger-menu-bold" className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-brand-orange/25 bg-brand-orange/5 text-brand-orange">{meta?.label || block.type}</Badge>
            <span className="text-[11px] text-muted-foreground">Blok {index + 1}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{meta?.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button type="button" size="icon" variant="ghost" aria-label="Pindah blok ke atas" disabled={index === 0} onClick={() => onMove(index, index - 1)}><AapmIcon name="arrowUp" className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Pindah blok ke bawah" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}><AapmIcon name="arrowDown" className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Hapus blok" onClick={() => onRemove(index)}><AapmIcon name="delete" className="h-4 w-4 text-danger" /></Button>
        </div>
      </div>
      <BlockFields block={block} onChange={onChange} />
    </article>
  );
}

export default function EditorialComposer({ value, onChange }) {
  const document = ensureEditorialDocument(value);
  const blocks = document.blocks;
  const commit = (nextBlocks) => onChange(createEditorialDocument(nextBlocks));
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
          <Badge variant="soft" className="w-fit bg-tint-green text-brand-green">{blocks.length}/80 blok</Badge>
        </div>
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
