// @ts-nocheck
import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import RichTextEditor from "@/components/admin/RichTextEditor";
import {
  Badge,
  Button,
  IconButton,
  Input,
  Label,
  Textarea,
} from "@/components/primitives";
import { cn } from "@/lib/utils";
import {
  EDITORIAL_TEXT_LIMIT,
  createEditorialBlock,
  createInlineEditorialDocument,
  editorialInlineContent,
  editorialTextLength,
  editorialVideoBlocks,
  ensureEditorialDocument,
} from "@/lib/editorialDocument";

function Field({ label, children, hint = "", id, required = false }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span className="ml-1 text-brand-orange" aria-hidden="true">*</span>}</Label>
      {children}
      {hint && <p className="text-[10px] leading-4 text-muted-foreground">{hint}</p>}
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

function VideoCard({ block, index, total, onChange, onMove, onRemove }) {
  const hasUrl = Boolean(block.url?.trim());
  const urlId = `${block.id}-url`;
  const captionId = `${block.id}-caption`;

  return (
    <article className="rounded-xl border border-brand-orange/20 bg-background p-4 shadow-sm" data-editorial-video-card>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange">
            <AapmIcon name="solar:play-circle-bold" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Video {index + 1}</div>
            <div className={cn("text-[10px]", hasUrl ? "text-brand-green" : "text-brand-orange")}>
              {hasUrl ? "Tautan siap diputar" : "Isi tautan video"}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {total > 1 && (
            <div role="group" aria-label={`Atur urutan Video ${index + 1}`} className="flex items-center gap-1">
              <IconButton size="sm" className="h-9 w-9 p-0" label={`Naikkan Video ${index + 1}`} tooltip="Naikkan video" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
                <AapmIcon name="chevronUp" className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton size="sm" className="h-9 w-9 p-0" label={`Turunkan Video ${index + 1}`} tooltip="Turunkan video" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>
                <AapmIcon name="chevronDown" className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          )}
          <IconButton size="sm" className="h-9 w-9 p-0 text-danger hover:bg-danger/5 hover:text-danger" label={`Hapus Video ${index + 1}`} tooltip="Hapus video" onClick={() => onRemove(index)}>
            <AapmIcon name="delete" className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>
      <div className="space-y-4">
        <Field
          id={urlId}
          label="Tautan video"
          required
          hint="YouTube, Vimeo, file HTTPS, atau file internal pada /assets/, /media/, atau /uploads/."
        >
          <Input
            id={urlId}
            type="text"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://youtu.be/..."
            value={block.url || ""}
            onChange={(event) => onChange({ url: event.target.value })}
            required
          />
        </Field>
        <Field id={captionId} label="Keterangan (opsional)">
          <Textarea
            id={captionId}
            rows={2}
            value={block.caption || ""}
            onChange={(event) => onChange({ caption: event.target.value })}
            placeholder="Contoh: Simak demonstrasi pemeriksaan harian."
          />
        </Field>
      </div>
    </article>
  );
}

export default function EditorialComposer({
  value,
  fallback = "",
  legacyVideoUrl = "",
  onChange,
  onLegacyVideoChange,
}) {
  const document = ensureEditorialDocument(value);
  const storedVideos = editorialVideoBlocks(value);
  const videos = storedVideos.length
    ? storedVideos
    : legacyVideoUrl.trim()
      ? [{ id: "legacy-video", type: "video", url: legacyVideoUrl, caption: "" }]
      : [];
  const inlineContent = editorialInlineContent(value, fallback);
  const richTextBlock = document.blocks.find((block) => block.type === "richText");
  const existingIds = new Set(document.blocks.map((block) => block.id));
  const richTextId = richTextBlock?.id || (existingIds.has("inline-content") ? "inline-content-text" : "inline-content");
  const textLength = editorialTextLength(createInlineEditorialDocument(inlineContent, videos, richTextId).blocks);
  const [announcement, setAnnouncement] = React.useState("");

  const commit = (nextContent = inlineContent, nextVideos = videos) => {
    const nextDocument = createInlineEditorialDocument(nextContent, nextVideos, richTextId);
    if (editorialTextLength(nextDocument.blocks) > EDITORIAL_TEXT_LIMIT) {
      setAnnouncement("Isi materi sudah mencapai batas maksimum.");
      return;
    }
    onChange(nextDocument.blocks.length ? nextDocument : null);
    if (legacyVideoUrl.trim()) onLegacyVideoChange?.("");
  };

  const updateInlineContent = (nextContent) => commit(nextContent, videos);

  const addVideo = () => {
    const nextVideo = createEditorialBlock("video");
    commit(inlineContent, [...videos, nextVideo]);
    setAnnouncement(`Video ${videos.length + 1} ditambahkan.`);
  };

  const updateVideo = (index, patch) => {
    commit(inlineContent, videos.map((video, currentIndex) => currentIndex === index ? { ...video, ...patch } : video));
  };

  const moveVideo = (sourceIndex, destinationIndex) => {
    const nextVideos = moveInList(videos, sourceIndex, destinationIndex);
    commit(inlineContent, nextVideos);
    setAnnouncement(`Video dipindahkan ke posisi ${destinationIndex + 1}.`);
  };

  const removeVideo = (index) => {
    const video = videos[index];
    if (!video || !window.confirm(`Hapus Video ${index + 1}?`)) return;
    commit(inlineContent, videos.filter((_, currentIndex) => currentIndex !== index));
    setAnnouncement(`Video ${index + 1} dihapus.`);
  };

  return (
    <div className="space-y-5" data-editorial-mode="inline">
      <div className="sr-only" aria-live="polite">{announcement}</div>

      <section className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
              <AapmIcon name="solar:pen-new-square-bold" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-green">Isi materi</p>
              <h3 className="mt-1 text-base font-semibold">Tulis seperti dokumen biasa</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Satu kanvas untuk paragraf, judul, daftar, penekanan, dan tautan. Tidak perlu membuat blok baru.</p>
            </div>
          </div>
          <Badge variant="soft" className="bg-background text-brand-green">{textLength.toLocaleString("id-ID")} byte teks</Badge>
        </div>
        <div className="mt-4 rounded-xl bg-background shadow-sm">
          <RichTextEditor
            id="module-inline-editor"
            value={inlineContent}
            onChange={updateInlineContent}
          />
        </div>
        <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Taruh kursor di baris yang ingin diubah lalu pilih <strong>Paragraf</strong>, <strong>Judul 1</strong>, <strong>Judul 2</strong>, atau <strong>Judul 3</strong>. Enter membuat paragraf berikutnya secara normal.</p>
      </section>

      <section className="rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
              <AapmIcon name="solar:play-circle-bold" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Video pembelajaran</p>
              <h3 className="mt-1 text-base font-semibold">Tambahkan video sebagai kartu terpisah</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Video tetap punya urutan sendiri, tanpa mengganggu alur tulisan di atas.</p>
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addVideo}>
            <AapmIcon name="add" className="h-3.5 w-3.5" />Tambah video
          </Button>
        </div>
        {videos.length ? (
          <div className="mt-4 space-y-3">
            {videos.map((video, index) => (
              <VideoCard
                key={video.id}
                block={video}
                index={index}
                total={videos.length}
                onChange={(patch) => updateVideo(index, patch)}
                onMove={moveVideo}
                onRemove={removeVideo}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-brand-orange/25 bg-background/70 px-4 py-5 text-center text-xs leading-5 text-muted-foreground">Belum ada video. Tambahkan hanya jika modul ini memiliki materi video.</div>
        )}
      </section>
    </div>
  );
}
