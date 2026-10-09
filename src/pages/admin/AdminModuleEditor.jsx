// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import AapmIcon from "@/components/icons/AapmIcon";
import { EditorialContent, EditorialMarkdown } from "@/components/academy/EditorialContent";
import { LessonStructuredContent } from "@/components/academy/LessonStructuredContent";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import EditorialComposer, { editorialInsertGroups } from "@/components/admin/EditorialComposer";
import AdminModuleCompanion from "@/components/admin/AdminModuleCompanion";
import EditorOutline from "@/components/admin/EditorOutline";
import EditorActionBar from "@/components/admin/EditorActionBar";
import CurriculumPublishingPanel from "@/components/admin/CurriculumPublishingPanel";
import { useQueryClient } from "@tanstack/react-query";
import { curriculumModule, recoverCurriculumDraft } from "@/lib/curriculumEditorState";
import useModalFocus from "@/components/ai/useModalFocus";
import { levelVisual } from "@/lib/academyVisuals";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Surface,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
  Alert,
  Field,
  IconTile,
  IconButton,
} from "@/components/primitives";
import {
  AdminError,
  AdminLoading,
  AdminPageFrame,
} from "@/components/admin/AdminPage";
import {
  useAdminModule,
  useAdminCourse,
  useAdminModuleQuestions,
  useCreateAdminModule,
  useDeleteAdminQuestion,
  useAdminAiSettings,
  useSaveAdminQuestion,
  useUpdateAdminModule,
} from "@/lib/useAdminData";
import { hasEditorialVideo, normaliseEditorialPresentation, parseEditorialDocument } from "@/lib/editorialDocument";
import {
  aiEditorialMaterialLabel,
  aiEditorialMaterialPrompt,
  aiEditorialMaterialSource,
  applyAiEditorialMaterial,
  normaliseAiEditorialMaterial,
} from "@/lib/aiEditorialRewrite";
import { useAuth } from "@/lib/AuthContext";
import { reconcileSavedModule } from "@/lib/editorSaveState";

const emptyModule = {
  levelNumber: 1,
  levelName: "Foundation",
  moduleNumber: "",
  title: "",
  category: "",
  summary: "",
  content: "",
  editorialContent: null,
  videoUrl: "",
  videoScript: "",
  learningObjectives: "",
  keyTakeaways: "",
  checklist: "",
  practicalAssignment: "",
  order: "",
};
const emptyQuestion = {
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctIndex: "0",
  explanation: "",
  difficulty: "medium",
  learningObjective: "",
};
const listToText = (value) => (Array.isArray(value) ? value.join("\n") : "");
const textToList = (value) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const aiList = (value, limit = 4) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|•/)
      : [];
  return values
    .map((item) => String(item || "").replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
};

function normaliseAiModuleDraft(value, materialSource = []) {
  if (!value || typeof value !== "object") return null;
  const hasField = (field) => Object.prototype.hasOwnProperty.call(value, field);
  const draft = {
    title: typeof value.title === "string" ? value.title.trim().slice(0, 180) : "",
    summary: typeof value.summary === "string" ? value.summary.trim().slice(0, 600) : "",
    learningObjectives: aiList(value.learningObjectives),
    keyTakeaways: aiList(value.keyTakeaways),
    checklist: aiList(value.checklist),
    practicalAssignment: typeof value.practicalAssignment === "string"
      ? value.practicalAssignment.trim().slice(0, 1200)
      : "",
    materialBlocks: normaliseAiEditorialMaterial(value.materialBlocks, materialSource),
    // Keep presence separate from the normalised value. A partial APPI
    // response must not clear an existing field merely because its key was
    // omitted; explicitly returned empty list/assignment values remain
    // available when the editor intentionally wants to clear those fields.
    fieldPresence: {
      title: hasField("title"),
      summary: hasField("summary"),
      learningObjectives: hasField("learningObjectives"),
      keyTakeaways: hasField("keyTakeaways"),
      checklist: hasField("checklist"),
      practicalAssignment: hasField("practicalAssignment"),
    },
  };
  return draft.title || draft.summary || draft.learningObjectives.length || draft.keyTakeaways.length || draft.checklist.length || draft.practicalAssignment || draft.materialBlocks.length
    ? draft
    : null;
}

function parseAiModuleDraft(reply, materialSource = []) {
  const raw = String(reply || "").trim();
  if (!raw) return null;
  const candidates = [
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(),
  ];
  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(raw.slice(objectStart, objectEnd + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = normaliseAiModuleDraft(JSON.parse(candidate), materialSource);
      if (parsed) return parsed;
    } catch {
      // APPI may wrap JSON in a short explanation; try the next candidate.
    }
  }
  return null;
}

function editorialContextForAi(form, { includeBlocks = true } = {}) {
  const document = parseEditorialDocument(form?.editorialContent);
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const blockText = includeBlocks ? blocks
    .flatMap((block) => [block?.title, block?.content, block?.caption, block?.description, block?.label])
    .filter(Boolean)
    .join("\n")
    .slice(0, 2600) : "";
  return [
    `Judul modul: ${String(form?.title || "").trim()}`,
    `Kategori: ${String(form?.category || "").trim()}`,
    `Ringkasan: ${String(form?.summary || "").trim()}`,
    blockText ? `Materi utama:\n${blockText}` : "",
  ].filter(Boolean).join("\n");
}

function CompactListField({ id, label, value, onChange, icon = "target", tone = "green" }) {
  const rawPoints = String(value || "").split(/\r?\n/);
  const points = rawPoints.length ? rawPoints : [""];
  const count = textToList(String(value || "")).length;
  const pointInputRefs = useRef([]);
  const focusPointRef = useRef(null);

  useEffect(() => {
    if (focusPointRef.current === null) return;
    const focusIndex = focusPointRef.current;
    focusPointRef.current = null;
    pointInputRefs.current[focusIndex]?.focus();
  }, [points.length]);

  const emitPoints = (nextPoints) => {
    onChange({ target: { value: nextPoints.join("\n") } });
  };

  const insertPointAfter = (index) => {
    const insertionIndex = Math.min(index + 1, points.length);
    const nextPoints = [
      ...points.slice(0, insertionIndex),
      "",
      ...points.slice(insertionIndex),
    ];
    focusPointRef.current = insertionIndex;
    emitPoints(nextPoints);
  };

  const removePoint = (index) => {
    const nextPoints = points.filter((_, pointIndex) => pointIndex !== index);
    focusPointRef.current = Math.max(0, Math.min(index - 1, nextPoints.length - 1));
    emitPoints(nextPoints.length ? nextPoints : [""]);
  };

  return (
    <div className="aapm-editor-point-card min-w-0" data-hue={tone === "orange" ? "orange" : "green"}>
      <div className="aapm-editor-point-card__head">
        <IconTile icon={icon} hue={tone === "orange" ? "orange" : "green"} size="xs" shape="circle" />
        <Label htmlFor={`${id}-point-1`} className="min-w-0 flex-1">{label}</Label>
        <Badge hue={tone === "orange" ? "orange" : "green"}>{count} poin</Badge>
      </div>
      <div className="aapm-editor-point-list space-y-1.5" role="list" aria-label={`${label} untuk learner`}>
        {points.map((point, index) => (
          <div key={`${id}-point-${index + 1}`} className="aapm-editor-point-row grid" role="listitem">
            <span className="aapm-editor-point-index" aria-hidden="true">{index + 1}</span>
            <Input
              ref={(element) => { pointInputRefs.current[index] = element; }}
              id={`${id}-point-${index + 1}`}
              value={point}
              onChange={(event) => {
                const nextPoints = [...points];
                nextPoints[index] = event.target.value;
                emitPoints(nextPoints);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertPointAfter(index);
                }
              }}
              className="aapm-editor-point-input"
              placeholder={`Tulis poin ${index + 1}…`}
              aria-label={`${label}, poin ${index + 1}`}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="aapm-editor-point-action"
              onClick={() => removePoint(index)}
              disabled={points.length === 1 && !point.trim()}
              aria-label={`Hapus ${label.toLowerCase()} poin ${index + 1}`}
              title={`Hapus poin ${index + 1}`}
            >
              <AapmIcon name="delete" className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <button type="button" className="aapm-editor-point-add" onClick={() => insertPointAfter(points.length - 1)}>
        <AapmIcon name="plus" />Tambah poin
      </button>
    </div>
  );
}

function AiModuleDraft({ form, onApply, toast }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState(null);
  const [rewriteDraft, setRewriteDraft] = useState(null);
  const [includeMaterial, setIncludeMaterial] = useState(true);
  const [pendingRewrite, setPendingRewrite] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const materialSource = useMemo(
    () => aiEditorialMaterialSource(form?.editorialContent, form?.content),
    [form?.content, form?.editorialContent],
  );
  const rewriteMaterialSource = includeMaterial ? materialSource : [];
  const canRewrite = Boolean(
    String(form?.title || form?.summary || form?.learningObjectives || form?.keyTakeaways || form?.checklist || form?.practicalAssignment || "").trim()
    || rewriteMaterialSource.length,
  );
  const { data: aiSettings, error: aiSettingsError, isLoading: isLoadingAiSettings } = useAdminAiSettings();
  const providerReady = aiSettings
    ? Boolean(aiSettings.enabled && aiSettings.apiKeyConfigured)
    : null;

  const providerStatus = aiSettingsError
    ? { label: "Status provider belum terbaca", icon: "info", className: "bg-surface-subtle text-muted-foreground" }
    : isLoadingAiSettings
      ? { label: "Memeriksa provider…", icon: "refresh", className: "bg-surface-subtle text-muted-foreground" }
      : providerReady
        ? { label: `${aiSettings.providerLabel || "Provider AI"} siap`, icon: "checkRead", className: "bg-tint-green text-tint-green-foreground" }
        : { label: "Provider perlu disiapkan", icon: "info", className: "bg-tint-orange text-tint-orange-foreground" };

  const generate = async () => {
    setIsGenerating(true);
    try {
      const context = editorialContextForAi(form);
      const response = await nativeApi.ai.assistant({
        includeFarmContext: false,
        farmContext: [],
        message: [
          "Anda adalah editor kurikulum AAPM. Buat draf konten learner dalam bahasa Indonesia yang ringkas, spesifik, dan dapat diamati.",
          "Kembalikan SATU objek JSON valid tanpa markdown, tanpa code fence, dan tanpa penjelasan tambahan dengan bentuk persis:",
          '{"title":"judul modul yang lebih jelas","summary":"ringkasan modul maksimal 2 kalimat","learningObjectives":["maksimal 3 tujuan"],"keyTakeaways":["maksimal 3 poin penting"],"checklist":["maksimal 3 cek observasi"],"practicalAssignment":"satu tugas praktik singkat"}',
          "Tujuan harus memakai kata kerja aktif. Checklist harus bisa diverifikasi learner. Jangan mengarang angka atau klaim medis.",
          context,
          instruction.trim() ? `Fokus tambahan editor: ${instruction.trim().slice(0, 400)}` : "",
        ].filter(Boolean).join("\n\n"),
      });
      if (response?.fallback || (response?.providerStatus && response.providerStatus !== "ready")) {
        throw new Error(
          response?.notice
            ? `${response.notice} Buka Pengaturan AI untuk mengaktifkan provider sebelum membuat draf.`
            : "Provider AI belum siap. Buka Pengaturan AI untuk mengaktifkan provider sebelum membuat draf.",
        );
      }
      const parsed = parseAiModuleDraft(response?.reply);
      if (!parsed) throw new Error("APPI belum mengembalikan draf terstruktur. Coba lagi dengan fokus yang lebih spesifik.");
      setDraft(parsed);
      toast({ title: "Draf APPI siap", description: "Periksa hasilnya, lalu pilih Gunakan draf untuk memasukkannya ke form." });
    } catch (error) {
      toast({ variant: "destructive", title: "Draf APPI belum siap", description: error?.message || "APPI tidak dapat menyiapkan draf saat ini." });
    } finally {
      setIsGenerating(false);
    }
  };

  const rewrite = async () => {
    setIsRewriting(true);
    try {
      const context = editorialContextForAi(form, { includeBlocks: false });
      const materialPrompt = aiEditorialMaterialPrompt(rewriteMaterialSource);
      const hasMaterialRewrite = rewriteMaterialSource.length > 0;
      const response = await nativeApi.ai.rewriteEditorial({
        message: [
          "Anda adalah copywriter kurikulum AAPM. Tulis ulang isi modul yang sudah ada dalam bahasa Indonesia agar lebih jelas, ringkas, konsisten, dan mudah dipindai learner.",
          "Pertahankan maksud, fakta, urutan, dan batasan keselamatan dari naskah asli. Jangan menambah angka, klaim medis, atau informasi baru.",
          "Kembalikan SATU objek JSON valid tanpa code fence atau penjelasan tambahan dengan bentuk persis:",
          '{"title":"opsional","summary":"opsional","learningObjectives":["maksimal 3 tujuan"],"keyTakeaways":["maksimal 3 poin penting"],"checklist":["maksimal 3 cek observasi"],"practicalAssignment":"satu tugas praktik singkat","materialBlocks":[{"id":"id sumber","type":"richText|heading|callout","content":"Markdown atau teks hasil rewrite"}]}',
          "Setiap item harus satu kalimat aktif. Jika suatu bagian kosong, kembalikan array kosong atau string kosong.",
          hasMaterialRewrite ? [
            "Tulis ulang juga blok teks materi di bawah ini. Hanya gunakan id dan type yang sudah ada; jangan membuat, menghapus, atau menukar urutan blok.",
            "Untuk richText, content adalah Markdown. Pertahankan sintaks heading, bold, italic, underline (++, jika ada), strike, daftar, kutipan, dan line break. Token ⟦APPI_MEDIA_n⟧ adalah gambar/tautan yang wajib disalin persis pada posisi yang sama; jangan diubah atau dihapus. Jangan menambahkan HTML, URL, gambar, atau tautan baru.",
            "Untuk heading, ubah hanya teksnya dan jangan menambahkan awalan #. Untuk callout, pertahankan struktur title/content dan jangan mengubah nadanya.",
            `Blok materi sumber (JSON):\n${materialPrompt}`,
          ].join("\n") : "",
          context,
          `Isi terstruktur saat ini:\nJudul:\n${String(form?.title || "")}\nRingkasan:\n${String(form?.summary || "")}\nTujuan:\n${String(form?.learningObjectives || "")}\nPoin penting:\n${String(form?.keyTakeaways || "")}\nChecklist:\n${String(form?.checklist || "")}\nTugas praktik:\n${String(form?.practicalAssignment || "")}`,
          instruction.trim() ? `Gaya copywriting yang diminta editor: ${instruction.trim().slice(0, 400)}` : "Gaya: editorial, lugas, dan profesional.",
        ].filter(Boolean).join("\n\n"),
      });
      if (response?.fallback || (response?.providerStatus && response.providerStatus !== "ready")) {
        throw new Error(response?.notice ? `${response.notice} Buka Pengaturan AI untuk mengaktifkan provider sebelum rewrite.` : "Provider AI belum siap. Buka Pengaturan AI untuk menjalankan rewrite.");
      }
      const parsed = parseAiModuleDraft(response?.reply, rewriteMaterialSource);
      if (!parsed) throw new Error("APPI belum mengembalikan rewrite terstruktur. Coba lagi dengan instruksi yang lebih spesifik.");
      if (hasMaterialRewrite && !parsed.materialBlocks.length) {
        throw new Error("APPI belum mengembalikan blok materi yang aman untuk diterapkan. Coba lagi dengan blok materi yang lebih pendek.");
      }
      setRewriteDraft(parsed);
      toast({ title: "Rewrite APPI siap ditinjau", description: hasMaterialRewrite ? "Format Markdown, gambar, dan tautan ditahan sampai Anda mengonfirmasi hasilnya." : "Tidak ada isi yang diganti sebelum Anda mengonfirmasi hasilnya." });
    } catch (error) {
      toast({ variant: "destructive", title: "Rewrite APPI belum siap", description: error?.message || "APPI tidak dapat menulis ulang modul saat ini." });
    } finally {
      setIsRewriting(false);
    }
  };

  const applyDraft = () => {
    if (!draft) return;
    onApply(draft);
    setDraft(null);
    toast({ title: "Draf APPI diterapkan", description: "Tinjau poin-poinnya sebelum menyimpan modul." });
  };

  const applyRewrite = () => {
    if (!rewriteDraft) return;
    onApply(rewriteDraft);
    setRewriteDraft(null);
    setPendingRewrite(false);
    toast({ title: "Rewrite APPI diterapkan", description: "Isi lokal berubah sebagai draft. Periksa kembali, lalu pilih Simpan modul." });
  };

  return (
    <>
    <div className="aapm-token-card border border-brand-orange/25 bg-tint-orange/35 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-brand-orange">
          <AapmIcon name="ai" className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Bantu isi dengan APPI</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Buat draf tujuan, insight, tugas, checklist, atau rewrite teks materi tanpa menimpa isi sebelum Anda menyetujuinya.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <Badge variant="soft" className={`max-w-full truncate text-[11px] ${providerStatus.className}`}>
            <AapmIcon name={providerStatus.icon} className={`h-3 w-3 ${providerStatus.icon === "refresh" ? "animate-spin" : ""}`} />
            {providerStatus.label}
          </Badge>
          {providerReady === false && <Link to="/admin/ai-settings" className="text-[11px] font-semibold text-brand-orange hover:underline">Buka Pengaturan AI</Link>}
        </div>
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 px-2.5 text-[11px]" onClick={() => setOpen((current) => !current)}>
          <AapmIcon name={open ? "chevronUp" : "ai"} className="h-3.5 w-3.5" />
          {open ? "Tutup" : "Buat draf"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 border-t border-brand-orange/20 pt-3">
          {providerReady === false && (
            <div role="status" className="mb-3 flex flex-wrap items-start gap-2 rounded-[var(--radius-control)] border border-brand-orange/20 bg-background/70 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              <AapmIcon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange" />
              <span className="min-w-0 flex-1">Provider aktif belum memiliki credential atau sedang dimatikan. Fallback lokal tetap aman, tetapi tidak menghasilkan draf JSON terstruktur untuk editor.</span>
              <Link to="/admin/ai-settings" className="shrink-0 font-semibold text-brand-orange hover:underline">Konfigurasi</Link>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Opsional: fokus, level learner, atau konteks tugas…"
              className="h-9 min-w-0 flex-1 text-xs"
              disabled={isGenerating || isRewriting}
            />
            <label className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-background/70 px-2.5 text-[11px] leading-4 text-muted-foreground sm:max-w-[15rem]">
              <input
                type="checkbox"
                checked={includeMaterial}
                onChange={(event) => setIncludeMaterial(event.target.checked)}
                disabled={isGenerating || isRewriting || materialSource.length === 0}
                className="h-4 w-4 shrink-0 accent-[hsl(var(--brand-green))]"
                aria-label="Sertakan teks materi dalam rewrite APPI"
              />
              <span>Termasuk teks materi <span className="text-muted-foreground/70">(format & media tetap)</span></span>
            </label>
            <Button type="button" size="sm" className="h-9 shrink-0" onClick={generate} disabled={isGenerating || isRewriting || !String(form?.title || form?.summary || "").trim()}>
              <AapmIcon name={isGenerating ? "refresh" : "ai"} className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Menyusun…" : "Generate"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={rewrite} disabled={isGenerating || isRewriting || !canRewrite}>
              <AapmIcon name={isRewriting ? "refresh" : "edit"} className={`h-3.5 w-3.5 ${isRewriting ? "animate-spin" : ""}`} />
              {isRewriting ? "Rewrite…" : includeMaterial && materialSource.length ? "Rewrite isi + materi" : "Rewrite isi"}
            </Button>
          </div>
          {draft && (
            <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">Pratinjau draf</p>
                <Badge variant="soft" className="text-[11px]">Belum diterapkan</Badge>
              </div>
              <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                {[
                  ["Tujuan", draft.learningObjectives],
                  ["Poin penting", draft.keyTakeaways],
                  ["Checklist", draft.checklist],
                ].map(([label, items]) => (
                  <div key={label} className="rounded-lg bg-surface-subtle p-2">
                    <p className="font-semibold text-foreground">{label}</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">{items.map((item) => <li key={item}>• {item}</li>)}</ul>
                  </div>
                ))}
                <div className="rounded-lg bg-surface-subtle p-2 sm:col-span-2">
                  <p className="font-semibold text-foreground">Tugas praktik</p>
                  <p className="mt-1 text-muted-foreground">{draft.practicalAssignment || "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" className="h-8 text-[11px]" onClick={() => setDraft(null)}>Buang</Button>
                <Button type="button" size="sm" className="h-8 text-[11px]" onClick={applyDraft}><AapmIcon name="checkRead" className="h-3.5 w-3.5" /> Gunakan draf</Button>
              </div>
            </div>
          )}
          {rewriteDraft && (
            <div className="mt-3 rounded-[var(--radius-control)] border border-brand-orange/35 bg-background p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-xs font-semibold">Pratinjau rewrite copywriting</p><p className="mt-0.5 text-[11px] text-muted-foreground">Hasil ini hanya usulan sampai Anda mengonfirmasi penggantian isi.</p></div>
                <Badge variant="soft" className="bg-tint-orange text-tint-orange-foreground text-[11px]">Konfirmasi diperlukan</Badge>
              </div>
              <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                {[['Judul', rewriteDraft.title], ['Ringkasan', rewriteDraft.summary]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="rounded-lg bg-surface-subtle p-2"><p className="font-semibold text-foreground">{label}</p><p className="mt-1 text-muted-foreground">{value}</p></div>)}
                {[["Tujuan", rewriteDraft.learningObjectives], ["Poin penting", rewriteDraft.keyTakeaways], ["Checklist", rewriteDraft.checklist]].map(([label, items]) => <div key={label} className="rounded-lg bg-surface-subtle p-2"><p className="font-semibold text-foreground">{label}</p><ul className="mt-1 space-y-0.5 text-muted-foreground">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>)}
                <div className="rounded-lg bg-surface-subtle p-2 sm:col-span-2"><p className="font-semibold text-foreground">Tugas praktik</p><p className="mt-1 text-muted-foreground">{rewriteDraft.practicalAssignment || "—"}</p></div>
              </div>
              {rewriteDraft.materialBlocks?.length > 0 && (
                <div className="mt-3 rounded-lg border border-border bg-surface-subtle/60 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">Materi teks</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{rewriteDraft.materialBlocks.length} blok dipratinjau · Markdown, gambar, dan tautan tetap dikunci.</p>
                    </div>
                    <Badge variant="soft" className="text-[11px]">Format dipertahankan</Badge>
                  </div>
                  <div className="mt-2 space-y-2">
                    {rewriteDraft.materialBlocks.map((block, index) => (
                      <article key={block.id || index} className="overflow-hidden rounded-lg border border-border bg-background p-2.5">
                        <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{aiEditorialMaterialLabel(block.type)}</span>
                          <span aria-hidden="true">·</span>
                          <span>Blok {index + 1}</span>
                        </div>
                        {block.type === "heading" && <p className="text-xs font-semibold text-foreground">{block.content}</p>}
                        {block.type === "callout" && <div className="text-xs"><p className="font-semibold text-foreground">{block.title || "Sorotan"}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{block.content}</p></div>}
                        {block.type === "richText" && <EditorialMarkdown className="max-w-none text-xs leading-5 [&_img]:my-2 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-2">{block.content}</EditorialMarkdown>}
                      </article>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" className="h-8 text-[11px]" onClick={() => setRewriteDraft(null)}>Buang rewrite</Button>
                <Button type="button" size="sm" className="h-8 text-[11px]" onClick={() => setPendingRewrite(true)}><AapmIcon name="checkRead" className="h-3.5 w-3.5" /> Tinjau & terapkan</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    <ConfirmDialog
      open={pendingRewrite}
      onOpenChange={setPendingRewrite}
      title="Ganti isi modul dengan rewrite APPI?"
      description="APPI hanya memberi usulan copywriting. Setelah dikonfirmasi, field modul dan blok teks materi yang dipratinjau akan diganti sebagai perubahan lokal. Markdown, gambar, tautan, urutan blok, dan media lain tetap dipertahankan. Anda tetap harus meninjau lalu memilih Simpan modul."
      confirmLabel="Terapkan rewrite"
      cancelLabel="Kembali ke pratinjau"
      icon="solar:stars-minimalistic-bold-duotone"
      onConfirm={applyRewrite}
    />
    </>
  );
}

const editorDraftPrefix = "aapm:academy:module-editor:v1";

const moduleFormSnapshot = (value) => JSON.stringify(value || {});

const EDITOR_SECTIONS = [
  { id: "module-section-content", label: "Materi", shortLabel: "Materi", detail: "Teks, slide, gambar, dan video", icon: "lesson" },
  { id: "module-section-outcomes", label: "Tujuan & insight", shortLabel: "Tujuan", detail: "Tujuan pembelajaran dan poin penting", icon: "target" },
  { id: "module-section-practice", label: "Praktik", shortLabel: "Praktik", detail: "Tugas, checklist, dan naskah video", icon: "practice" },
];

const INSPECTOR_TABS = [
  { id: "block", label: "Blok", icon: "widget" },
  { id: "module", label: "Modul", icon: "settings" },
  { id: "ai", label: "APPI", icon: "ai" },
];

const HUE_OPTIONS = [
  { value: "neutral", label: "Netral", hue: "neutral" },
  { value: "green", label: "Hijau", hue: "green" },
  { value: "orange", label: "Oranye", hue: "orange" },
  { value: "blue", label: "Biru", hue: "blue" },
  { value: "violet", label: "Violet", hue: "violet" },
];

/** Colour choice as swatches (radio group) instead of a text select. */
function HueSelect({ id, value, onChange }) {
  return (
    <div id={id} role="radiogroup" className="aapm-hue-select">
      {HUE_OPTIONS.map((option) => (
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
  );
}

function moduleFormFromApi(module) {
  module = curriculumModule(module);
  return {
    levelNumber: module?.level || 1,
    levelName: module?.levelName || "",
    moduleNumber: module?.moduleNumber || "",
    title: module?.title || "",
    category: module?.category || "",
    summary: module?.summary || "",
    content: module?.content || "",
    editorialContent: module?.editorialContent || null,
    videoUrl: module?.videoUrl || "",
    videoScript: module?.videoScript || "",
    learningObjectives: listToText(module?.learningObjectives),
    keyTakeaways: listToText(module?.keyTakeaways),
    checklist: listToText(module?.checklist),
    practicalAssignment: module?.practicalAssignment || "",
    order: module?.order || "",
  };
}

function moduleFormFromDraft(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const textValue = (value) => (typeof value === "string" ? value : "");
  const numberValue = (value, fallback = "") => value ?? fallback;
  return {
    levelNumber: numberValue(candidate.levelNumber, 1),
    levelName: textValue(candidate.levelName),
    moduleNumber: numberValue(candidate.moduleNumber),
    title: textValue(candidate.title),
    category: textValue(candidate.category),
    summary: textValue(candidate.summary),
    content: textValue(candidate.content),
    editorialContent: parseEditorialDocument(candidate.editorialContent) || null,
    videoUrl: textValue(candidate.videoUrl),
    videoScript: textValue(candidate.videoScript),
    learningObjectives: textValue(candidate.learningObjectives),
    keyTakeaways: textValue(candidate.keyTakeaways),
    checklist: textValue(candidate.checklist),
    practicalAssignment: textValue(candidate.practicalAssignment),
    order: numberValue(candidate.order),
  };
}

function editorDraftKey(accountId, courseId, moduleId) {
  if (!accountId || !courseId || !moduleId) return "";
  return `${editorDraftPrefix}:${encodeURIComponent(String(accountId))}:${encodeURIComponent(String(courseId))}:${encodeURIComponent(String(moduleId))}`;
}

function readEditorDraft(key) {
  if (!key || typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.form ||
      typeof parsed.form !== "object" ||
      (parsed.version !== undefined && parsed.version !== 1 && parsed.version !== 2)
    ) return null;
    const form = moduleFormFromDraft(parsed.form);
    if (!form) return null;
    return {
      form,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      serverSnapshot: typeof parsed.serverSnapshot === "string" ? parsed.serverSnapshot : "",
      draftVersion: parsed.draftVersion ?? null,
    };
  } catch {
    return null;
  }
}

function removeEditorDraft(key) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage failures must not block the editor.
  }
}

function writeEditorDraft(key, form, serverSnapshot = "", draftVersion = null) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({
      version: 2,
      savedAt: new Date().toISOString(),
      serverSnapshot,
      draftVersion,
      form,
    }));
  } catch {
    // Storage failures must not block the editor.
  }
}

function QuestionEditor({ moduleId, draftVersion, busy, conflict, onVersion, onError, beginWrite, endWrite, onDirty, resetKey }) {
  const { data, isLoading, error: loadError, refetch: reloadQuestions } = useAdminModuleQuestions(moduleId);
  const saveQuestion = useSaveAdminQuestion();
  const deleteQuestion = useDeleteAdminQuestion();
  const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const formRef = useRef(form);
  formRef.current = form;
  const [questionError, setQuestionError] = useState("");
  const [pendingQuestionDelete, setPendingQuestionDelete] = useState(null);
  useEffect(() => { setSelected(null); setForm(emptyQuestion); setQuestionError(""); }, [resetKey]);
  useEffect(() => { onDirty(JSON.stringify(form) !== JSON.stringify(emptyQuestion)); }, [form, onDirty]);
  const questions = data?.questions || [];
  const edit = (question) => {
    const options = question.options || [];
    setSelected(question);
    setForm({
      question: question.question || "",
      optionA: options[0] || "",
      optionB: options[1] || "",
      optionC: options[2] || "",
      optionD: options[3] || "",
      correctIndex: String(question.correctIndex ?? 0),
      explanation: question.explanation || "",
      difficulty: question.difficulty || "medium",
      learningObjective: question.learningObjective || "",
    });
  };
  const save = async (event) => {
    event.preventDefault();
    if (conflict || !beginWrite()) return;
    const submittedForm = formRef.current;
    setQuestionError("");
    try {
      const result = await saveQuestion.mutateAsync({
        moduleId,
        expectedDraftVersion: draftVersion,
        questionId: selected?.id,
        data: {
          question: form.question,
          options: [
            form.optionA,
            form.optionB,
            form.optionC,
            form.optionD,
          ].filter(Boolean),
          correctIndex: Number(form.correctIndex),
          explanation: form.explanation,
          difficulty: form.difficulty,
          type: "mcq",
          learningObjective: form.learningObjective,
        },
      });
      onVersion(result.draftVersion);
      if (JSON.stringify(formRef.current) === JSON.stringify(submittedForm)) {
        setSelected(null);
        setForm(emptyQuestion);
      } else setSelected(result.question);
      toast({ title: "Soal disimpan ke draf", description: "Materi dan soal terbit belum berubah." });
    } catch (error) {
      setQuestionError(error.message);
      onError(error);
      toast({
        variant: "destructive",
        title: "Soal belum disimpan",
        description: error.message,
      });
    } finally { endWrite(); }
  };
  const remove = async (question) => {
    if (conflict || !beginWrite()) return;
    setQuestionError("");
    try {
      const result = await deleteQuestion.mutateAsync({ moduleId, questionId: question.id, expectedDraftVersion: draftVersion });
      onVersion(result.draftVersion);
      if (selected?.id === question.id) {
        setSelected(null);
        setForm(emptyQuestion);
      }
      toast({ title: "Soal dihapus dari draf" });
    } catch (error) {
      setQuestionError(error.message);
      onError(error);
      toast({
        variant: "destructive",
        title: "Soal belum dihapus",
        description: error.message,
      });
    } finally { endWrite(); }
  };
  const set = (key, value) =>
    setForm((current) => { const next = { ...current, [key]: value }; formRef.current = next; return next; });
  return (
    <>
      {loadError && <AdminError error={loadError} onRetry={reloadQuestions} />}
      {questionError && <p role="alert" className="mb-3">{questionError} Form soal tetap tersedia. {conflict ? "Pilih tindakan pemulihan konflik di atas." : "Periksa isian dan simpan soal kembali."}</p>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)] xl:items-start">
      <section className="aapm-editor-panel" aria-labelledby="question-list-title">
        <header className="aapm-editor-panel__head">
          <IconTile icon="quiz" hue="orange" size="sm" shape="circle" />
          <div className="min-w-0 flex-1">
            <h2 id="question-list-title" className="aapm-editor-panel__title">Bank soal</h2>
            <p className="aapm-editor-panel__description">Pilihan ganda untuk modul ini.</p>
          </div>
          <Badge
            variant="soft"
            className="bg-tint-orange text-tint-orange-foreground"
          >
            {questions.length} soal
          </Badge>
        </header>
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-5 text-sm text-muted-foreground">
              Memuat soal…
            </div>
          ) : questions.length ? (
            questions.map((question, index) => (
              <div key={question.id} className="flex items-start gap-3 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tint-green text-xs font-semibold text-brand-green">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{question.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {question.options.length} opsi · jawaban{" "}
                    {Number(question.correctIndex) + 1} · {question.difficulty}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => edit(question)}
                    disabled={busy}
                    aria-label="Edit soal"
                  >
                    <AapmIcon name="edit" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPendingQuestionDelete(question)}
                    disabled={busy || Boolean(conflict)}
                    aria-label="Hapus soal"
                  >
                    <AapmIcon name="delete" className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-5 text-sm leading-6 text-muted-foreground">
              Belum ada soal. Tambahkan soal pertama dari form di samping.
            </div>
          )}
        </div>
      </section>
      <section className="aapm-editor-panel" aria-labelledby="question-form-title">
        <header className="aapm-editor-panel__head">
          <IconTile icon={selected ? "edit" : "add"} hue="green" size="sm" shape="circle" />
          <div className="min-w-0 flex-1">
            <h2 id="question-form-title" className="aapm-editor-panel__title">
              {selected ? "Edit soal" : "Tambah soal"}
            </h2>
          </div>
          {selected && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(null);
                setForm(emptyQuestion);
              }}
            >
              Batal
            </Button>
          )}
        </header>
        <form onSubmit={save} className="grid gap-3">
          <fieldset disabled={busy} className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="question-text">Pertanyaan</Label>
            <Textarea
              id="question-text"
              value={form.question}
              onChange={(event) => set("question", event.target.value)}
              rows={3}
              required
            />
          </div>
          {[
            ["optionA", "Opsi 1"],
            ["optionB", "Opsi 2"],
            ["optionC", "Opsi 3 (opsional)"],
            ["optionD", "Opsi 4 (opsional)"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`question-${key}`}>{label}</Label>
              <Input
                id={`question-${key}`}
                value={form[key]}
                onChange={(event) => set(key, event.target.value)}
                required={key === "optionA" || key === "optionB"}
              />
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="question-correct">Jawaban benar</Label>
              <Select
                value={form.correctIndex}
                onValueChange={(value) => set("correctIndex", value)}
              >
                <SelectTrigger id="question-correct">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((index) => (
                    <SelectItem key={index} value={String(index)}>
                      Opsi {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-difficulty">Kesulitan</Label>
              <Select
                value={form.difficulty}
                onValueChange={(value) => set("difficulty", value)}
              >
                <SelectTrigger id="question-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Mudah</SelectItem>
                  <SelectItem value="medium">Sedang</SelectItem>
                  <SelectItem value="hard">Sulit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="question-explanation">Penjelasan</Label>
            <Textarea
              id="question-explanation"
              value={form.explanation}
              onChange={(event) => set("explanation", event.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="question-objective">Tujuan pembelajaran</Label>
            <Input
              id="question-objective"
              value={form.learningObjective}
              onChange={(event) => set("learningObjective", event.target.value)}
            />
          </div>
          <Button
            className="w-full"
            type="submit"
            disabled={busy || Boolean(conflict) || saveQuestion.isPending}
          >
            {saveQuestion.isPending
              ? "Menyimpan…"
              : selected
                ? "Simpan soal ke draf"
                : "Tambah soal ke draf"}
          </Button>
          {JSON.stringify(form) !== JSON.stringify(emptyQuestion) && <Button type="button" variant="secondary" onClick={() => { setSelected(null); setForm(emptyQuestion); setQuestionError(""); }}>Batalkan perubahan soal</Button>}
          </fieldset>
        </form>
      </section>
      </div>
      <ConfirmDialog
        open={Boolean(pendingQuestionDelete)}
        onOpenChange={(open) => !open && setPendingQuestionDelete(null)}
        title="Hapus soal?"
        description="Soal akan dihapus dari draf. Bank soal terbit dan percobaan aktif tetap utuh sampai revisi baru diterbitkan."
        confirmLabel="Hapus soal"
        icon="delete"
        destructive
        onConfirm={() => {
          const question = pendingQuestionDelete;
          setPendingQuestionDelete(null);
          if (question) remove(question);
        }}
      />
    </>
  );
}

export default function AdminModuleEditor() {
  const { courseId, moduleId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isNew = moduleId === "new";
  const { data: course, isLoading: isLoadingCourse } = useAdminCourse(courseId);
  const newModuleParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isNewChapter = isNew && newModuleParams.get("newChapter") === "1";
  const newModuleDefaults = useMemo(() => {
    if (!isNew) return emptyModule;
    const requestedLevel = Number(newModuleParams.get("levelNumber"));
    const levelNumber = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 20
      ? requestedLevel : course?.curriculum?.[0]?.levelNumber || 1;
    const chapter = course?.curriculum?.find((level) => Number(level.levelNumber) === Number(levelNumber));
    const levelName = newModuleParams.get("levelName");
    return {
      ...emptyModule,
      levelNumber,
      levelName: chapter?.levelName || levelName || emptyModule.levelName,
      ...(isNewChapter ? { levelName: "Chapter baru" } : {}),
    };
  }, [course, isNew, isNewChapter, newModuleParams]);
  const accountId = user?.id ? String(user.id) : "";
  const editorModuleId = isNew ? "new" : moduleId;
  const { data, isLoading, error, refetch } = useAdminModule(
    isNew ? null : moduleId,
  );
  const createModule = useCreateAdminModule();
  const updateModule = useUpdateAdminModule();
  const [form, setForm] = useState(emptyModule);
  const [draftVersion, setDraftVersion] = useState(null);
  const draftVersionRef = useRef(draftVersion);
  draftVersionRef.current = draftVersion;
  const [serverView, setServerView] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const operationLockRef = useRef(false);
  const conflictRef = useRef(null);
  const [questionDirty, setQuestionDirty] = useState(false);
  const [questionResetKey, setQuestionResetKey] = useState(0);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [editorReady, setEditorReady] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [activeSection, setActiveSection] = useState(EDITOR_SECTIONS[0].id);
  const [inspectorTab, setInspectorTab] = useState("block");
  const [blockInspectorNode, setBlockInspectorNode] = useState(null);
  const [outlineSlot, setOutlineSlot] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  // Which bottom sheet is open on small screens: the outline or the inspector.
  const [drawer, setDrawer] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const handleBlockSelection = React.useCallback((selection) => {
    setSelectedBlock(selection);
    if (selection) setInspectorTab("block");
  }, []);
  const closeDrawer = () => setDrawer(null);
  // Below 640px the inspector is a bottom sheet. From 640px to 1199px it sits under
  // the canvas, so it is scrolled to instead.
  const openInspector = (tab) => {
    setInspectorTab(tab);
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 639px)").matches) {
      setDrawer("inspector");
      return;
    }
    if (window.matchMedia("(max-width: 1199px)").matches) {
      window.requestAnimationFrame(() => document.querySelector(".aapm-editor-inspector")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };
  const outlineDrawerRef = useModalFocus({ open: drawer === "outline", onClose: closeDrawer });
  const inspectorDrawerRef = useModalFocus({ open: drawer === "inspector", onClose: closeDrawer });

  // A sheet only applies within its breakpoint. Widening past it closes the sheet,
  // so the scrim never covers a layout where the panel is inline.
  useEffect(() => {
    if (!drawer || typeof window === "undefined") return undefined;
    const handleResize = () => {
      if (drawer === "inspector" && !window.matchMedia("(max-width: 639px)").matches) setDrawer(null);
      if (drawer === "outline" && !window.matchMedia("(max-width: 1199px)").matches) setDrawer(null);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawer]);

  // Picking or adding a block from the Susun sheet should reveal it on the canvas, so the
  // sheet closes when the selected block changes. Opening the sheet alone does not close it.
  const lastSelectedBlockIdRef = useRef(null);
  useEffect(() => {
    const id = selectedBlock?.id || null;
    if (id && id !== lastSelectedBlockIdRef.current && drawer === "outline") setDrawer(null);
    lastSelectedBlockIdRef.current = id;
  }, [selectedBlock?.id, drawer]);
  const initialFormRef = useRef(JSON.stringify(emptyModule));
  const serverFormSnapshotRef = useRef(moduleFormSnapshot(emptyModule));
  const editorContextRef = useRef("");
  const formRef = useRef(form);
  const saveInFlightRef = useRef(false);
  const isDirtyRef = useRef(false);
  const pendingNavigationRef = useRef(null);
  const historyGuardRef = useRef(null);
  const editorialComposerRef = useRef(null);
  const draftKey = useMemo(
    () => editorDraftKey(accountId, courseId, editorModuleId),
    [accountId, courseId, editorModuleId],
  );
  const editorContextKey = useMemo(
    () => `${accountId}:${courseId}:${editorModuleId}:${location.search}`,
    [accountId, courseId, editorModuleId, location.search],
  );
  const currentEditorContextRef = useRef(editorContextKey);
  currentEditorContextRef.current = editorContextKey;
  const draftKeyRef = useRef(draftKey);
  // The draft key this session has written. Only a draft this session wrote is
  // removed when the edit is undone, so a draft from an earlier visit still prompts.
  const draftWrittenKeyRef = useRef("");
  const formSnapshot = useMemo(() => moduleFormSnapshot(form), [form]);
  const isDirty = editorReady && formSnapshot !== initialFormRef.current;
  const editorialPresentation = useMemo(
    () => normaliseEditorialPresentation(parseEditorialDocument(form.editorialContent)?.presentation),
    [form.editorialContent],
  );
  const isSaving = createModule.isPending || updateModule.isPending;
  const identityIsComplete = Boolean(
    String(form.levelNumber ?? "").trim() &&
    form.levelName.trim() &&
    String(form.moduleNumber ?? "").trim() &&
    form.title.trim(),
  );

  useEffect(() => {
    const resizeHeadings = () => {
      ["module-title", "module-summary"].forEach((id) => {
        const field = document.getElementById(id);
        if (!field || !field.getClientRects().length) return;
        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
      });
    };
    resizeHeadings();
    window.addEventListener("resize", resizeHeadings);
    return () => window.removeEventListener("resize", resizeHeadings);
  }, [activeTab, form.title, form.summary]);

  useEffect(() => {
    formRef.current = form;
    draftKeyRef.current = draftKey;
    isDirtyRef.current = isDirty;
  }, [draftKey, form, isDirty]);

  const promptNavigation = (request) => {
    pendingNavigationRef.current = request;
    setPendingNavigation(request);
  };

  const clearNavigationPrompt = () => {
    pendingNavigationRef.current = null;
    setPendingNavigation(null);
  };

  const releaseHistoryGuard = () => {
    const guard = historyGuardRef.current;
    if (!guard?.active || typeof window === "undefined") return;
    if (
      window.location.href === guard.editorHref &&
      window.history.state?.[guard.stateKey] === guard.id
    ) {
      window.history.replaceState(guard.baseState, "", guard.editorHref);
    }
    guard.active = false;
  };

  useEffect(() => {
    const module = data?.module;
    if (!accountId || (isNew && isLoadingCourse) || (!isNew && !module)) return;
    if (editorContextRef.current === editorContextKey) return;

    const nextForm = isNew ? { ...newModuleDefaults } : moduleFormFromApi(module);
    const nextServerSnapshot = moduleFormSnapshot(nextForm);
    editorContextRef.current = editorContextKey;
    serverFormSnapshotRef.current = nextServerSnapshot;
    initialFormRef.current = nextServerSnapshot;
    setForm(nextForm);
    formRef.current = nextForm;
    setEditorReady(true);
    setSaveError("");
    setSavedAt(null);
    setDrawer(null);
    setDraftVersion(data?.draft?.version ?? null);
    setServerView(data || null);
    setConflict(null);
    setPreviewData(null);
    setPreviewError("");
    setQuestionDirty(false);

    const draft = readEditorDraft(draftKey);
    const draftSnapshot = draft ? moduleFormSnapshot(draft.form) : "";
    const draftMatchesCurrentServer = draft?.serverSnapshot
      ? draft.serverSnapshot === nextServerSnapshot
      : false;
    if (
      draft &&
      draftSnapshot !== nextServerSnapshot
    ) {
      if (location.state?.preserveEditorDraft && draftMatchesCurrentServer) {
        setForm(draft.form);
        formRef.current = draft.form;
        setPendingDraft(null);
      } else setPendingDraft({ key: draftKey, ...draft, stale: Boolean((draft.serverSnapshot && !draftMatchesCurrentServer) || (draft.draftVersion !== null && draft.draftVersion !== data?.draft?.version)) });
    } else {
      removeEditorDraft(draftKey);
      setPendingDraft(null);
    }
  }, [accountId, data, draftKey, editorContextKey, isLoadingCourse, isNew, location.state, newModuleDefaults]);

  useEffect(() => {
    if (!editorReady || !isDirty || !draftKey) return undefined;
    draftWrittenKeyRef.current = draftKey;
    const timeoutId = window.setTimeout(
      () => writeEditorDraft(draftKey, form, serverFormSnapshotRef.current, draftVersion),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [draftKey, draftVersion, editorReady, form, isDirty]);

  useEffect(() => {
    if (!editorReady || isDirty || !draftKey || draftWrittenKeyRef.current !== draftKey) return;
    draftWrittenKeyRef.current = "";
    removeEditorDraft(draftKey);
  }, [draftKey, editorReady, isDirty]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      writeEditorDraft(
        draftKeyRef.current,
        formRef.current,
        serverFormSnapshotRef.current,
        draftVersionRef.current,
      );
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!editorReady || typeof window === "undefined") return undefined;
    if (historyGuardRef.current?.active) return undefined;

    const stateKey = "__aapmEditorGuard";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const editorHref = window.location.href;
    const baseState = window.history.state;
    const sentinelState = {
      ...(baseState && typeof baseState === "object" ? baseState : {}),
      [stateKey]: id,
    };

    window.history.pushState(sentinelState, "", editorHref);
    historyGuardRef.current = {
      active: true,
      allowPop: false,
      baseState,
      editorHref,
      id,
      sentinelState,
      stateKey,
    };

    const handlePopState = () => {
      const guard = historyGuardRef.current;
      if (!guard?.active) return;

      if (guard.allowPop) {
        guard.allowPop = false;
        guard.active = false;
        return;
      }

      // The extra same-URL entry gives browser Back a safe interception point
      // before React Router can render another page.
      if (window.location.href !== guard.editorHref) return;

      if (!isDirtyRef.current) {
        guard.allowPop = true;
        window.history.go(-1);
        return;
      }

      writeEditorDraft(
        draftKeyRef.current,
        formRef.current,
        serverFormSnapshotRef.current,
        draftVersionRef.current,
      );
      window.history.pushState(guard.sentinelState, "", guard.editorHref);
      promptNavigation({ type: "history-back" });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (historyGuardRef.current?.active) releaseHistoryGuard();
    };
  }, [editorReady, isDirty]);

  useEffect(() => {
    if (!editorReady || typeof document === "undefined") return undefined;

    const handleDocumentClick = (event) => {
      if (
        !isDirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a[href]") : null;
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank" ||
        anchor.closest("[contenteditable=\"true\"]")
      ) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextTarget = `${url.pathname}${url.search}${url.hash}`;
      const currentTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextTarget === currentTarget) return;

      event.preventDefault();
      event.stopPropagation();
      writeEditorDraft(
        draftKeyRef.current,
        formRef.current,
        serverFormSnapshotRef.current,
        draftVersionRef.current,
      );
      promptNavigation({ target: nextTarget, type: "route" });
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [editorReady]);

  useEffect(() => {
    if (
      !editorReady ||
      activeTab !== "content" ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) return undefined;

    const sectionElements = EDITOR_SECTIONS
      .map((section) => document.getElementById(section.id))
      .filter(Boolean);
    if (!sectionElements.length) return undefined;
    const scrollTargets = [window, document.querySelector("main")].filter(Boolean);

    const updateActiveSection = () => {
      const marker = Math.max(96, Math.min(window.innerHeight * 0.32, 280));
      const reachedSections = sectionElements.filter((element) => element.getBoundingClientRect().top <= marker);
      const currentSection = reachedSections[reachedSections.length - 1] || sectionElements[0];
      setActiveSection((previous) => (previous === currentSection.id ? previous : currentSection.id));
    };
    let frameId = 0;
    const handleViewportChange = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateActiveSection();
      });
    };

    updateActiveSection();
    scrollTargets.forEach((target) => target.addEventListener("scroll", handleViewportChange, { passive: true }));
    window.addEventListener("resize", handleViewportChange);
    return () => {
      scrollTargets.forEach((target) => target.removeEventListener("scroll", handleViewportChange));
      window.removeEventListener("resize", handleViewportChange);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [activeTab, editorReady]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleEditorShortcut = (event) => {
      if (event.defaultPrevented || event.isComposing) return;

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "s") {
        event.preventDefault();
        if (!isSaving) document.getElementById("module-editor-form")?.requestSubmit();
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const section = EDITOR_SECTIONS[Number(event.key) - 1];
        if (!section) return;
        event.preventDefault();
        setActiveTab("content");
        setActiveSection(section.id);
        window.requestAnimationFrame(() => {
          document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };

    window.addEventListener("keydown", handleEditorShortcut);
    return () => window.removeEventListener("keydown", handleEditorShortcut);
  }, [isSaving]);

  const set = (key, value) => {
    setSaveError("");
    setForm((current) => {
      const next = { ...current, [key]: value };
      formRef.current = next;
      return next;
    });
  };
  const setEditorialPresentation = (section, key, value) => {
    const current = parseEditorialDocument(form.editorialContent) || { version: 1, blocks: [] };
    const presentation = normaliseEditorialPresentation(current.presentation);
    set("editorialContent", {
      ...current,
      presentation: {
        ...presentation,
        [section]: { ...presentation[section], [key]: value },
      },
    });
  };
  const requestNavigation = (target) => {
    if (!isDirty) {
      releaseHistoryGuard();
      navigate(target);
      return;
    }
    writeEditorDraft(
      draftKeyRef.current,
      formRef.current,
      serverFormSnapshotRef.current,
      draftVersionRef.current,
    );
    promptNavigation({ target, type: "route" });
  };
  const scrollToEditorSection = (sectionId) => {
    setActiveTab("content");
    setActiveSection(sectionId);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const submitEditorForm = () => {
    if (!isSaving) document.getElementById("module-editor-form")?.requestSubmit();
  };
  const handleInvalidField = (event) => {
    event.preventDefault();
    const control = event.target;
    if (control !== event.currentTarget.querySelector(":invalid")) return;
    const label = { "module-number": "Nomor modul", "module-level-number": "Nomor chapter", "module-level-name": "Nama chapter", "module-title": "Judul modul" }[control.id] || "Field ini";
    const message = control.validity.valueMissing ? `${label} wajib diisi.`
      : control.type === "number" ? `${label} harus berupa bilangan bulat dari ${control.min} sampai ${control.max}.`
        : control.validationMessage || "Lengkapi field wajib sebelum menyimpan.";
    setSaveError(message);
    if (control.closest(".aapm-editor-inspector")) openInspector("module");
    window.requestAnimationFrame(() => {
      // Native validation can target a field inside a hidden inspector tab/sheet.
      // Reveal it before moving focus so the next action is immediately available.
      const firstInvalid = document.querySelector("#module-editor-form :invalid");
      firstInvalid?.focus();
      firstInvalid?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };
  const save = async (event) => {
    event.preventDefault();
    if (saveInFlightRef.current || operationLockRef.current || conflict) return;
    if (editorialComposerRef.current?.validate?.() === false) {
      setSaveError("Lengkapi blok materi yang ditandai sebelum menyimpan.");
      toast({
        variant: "destructive",
        title: "Lengkapi blok materi terlebih dahulu",
        description: "Periksa kartu kualitas di Materi utama, lalu lengkapi blok yang ditandai.",
      });
      return;
    }
    const submittedForm = formRef.current;
    if (!submittedForm.content.trim() && !parseEditorialDocument(submittedForm.editorialContent)?.blocks?.some((block) => block.type !== "divider")) {
      setSaveError("Tambahkan materi utama sebelum menyimpan modul.");
      scrollToEditorSection("module-section-content");
      return;
    }
    const submittedContext = editorContextKey;
    const payload = {
      ...submittedForm,
      levelNumber: Number(submittedForm.levelNumber),
      moduleNumber: Number(submittedForm.moduleNumber),
      order: Number(submittedForm.order || 0),
      learningObjectives: textToList(submittedForm.learningObjectives),
      keyTakeaways: textToList(submittedForm.keyTakeaways),
      checklist: textToList(submittedForm.checklist),
    };
    if (!isNew && payload.videoUrl === (data?.module?.videoUrl || "")) {
      delete payload.videoUrl;
    }
    saveInFlightRef.current = true;
    operationLockRef.current = true;
    setOperationBusy(true);
    try {
      const result = isNew
        ? await createModule.mutateAsync(payload)
        : await updateModule.mutateAsync({ moduleId, data: payload, expectedDraftVersion: draftVersion });
      if (currentEditorContextRef.current !== submittedContext) return;
      const saved = result?.module || result;
      toast({
        title: "Draf disimpan",
        description: "Draf aman di server. Validasi dan terbitkan untuk mengaktifkan revisi baru di Academy.",
      });
      const savedForm = saved?.id ? moduleFormFromApi(saved) : submittedForm;
      const savedSnapshot = moduleFormSnapshot(savedForm);
      const nextForm = reconcileSavedModule(submittedForm, formRef.current, savedForm);
      const hasNewEdits = moduleFormSnapshot(nextForm) !== savedSnapshot;
      serverFormSnapshotRef.current = savedSnapshot;
      initialFormRef.current = savedSnapshot;
      setForm(nextForm);
      formRef.current = nextForm;
      if (hasNewEdits) {
        const nextDraftKey = isNew && saved?.id ? editorDraftKey(accountId, courseId, saved.id) : draftKey;
        writeEditorDraft(nextDraftKey, nextForm, savedSnapshot, result.draft.version);
        if (nextDraftKey !== draftKey) removeEditorDraft(draftKey);
      } else removeEditorDraft(draftKey);
      setSaveError("");
      setSavedAt(new Date());
      setEditorReady(true);
      setDraftVersion(result.draft.version);
      setServerView(result);
      setPreviewData(null);
      if (!hasNewEdits || isNew) releaseHistoryGuard();
      if (isNew && saved?.id)
        navigate(`/admin/courses/${courseId}/modules/${saved.id}`, {
          replace: true,
          state: { preserveEditorDraft: hasNewEdits },
        });
    } catch (saveError) {
      if (currentEditorContextRef.current !== submittedContext) return;
      setSaveError(saveError?.message || "Periksa isian, lalu coba lagi.");
      handleEditorialError(saveError);
      toast({
        variant: "destructive",
        title: "Modul belum disimpan",
        description: saveError.message,
      });
    } finally {
      saveInFlightRef.current = false;
      operationLockRef.current = false;
      setOperationBusy(false);
    }
  };
  const beginEditorialWrite = () => {
    if (operationLockRef.current || conflict) return false;
    operationLockRef.current = true;
    setOperationBusy(true);
    return true;
  };
  const endEditorialWrite = () => { operationLockRef.current = false; setOperationBusy(false); };
  const handleEditorialError = (editorError) => {
    if (editorError?.status === 409 && editorError?.code === "revision_conflict") {
      setConflict(editorError);
      // Flush the current values before focusing recovery, including edits made during the request.
      writeEditorDraft(draftKey, formRef.current, serverFormSnapshotRef.current, draftVersion);
      requestAnimationFrame(() => conflictRef.current?.focus());
    } else if (editorError?.message) {
      setSaveError(editorError.message);
    }
  };
  const acceptServerDraft = (latest, keepChanges = false, submittedForm = null) => {
    const latestForm = moduleFormFromApi(latest.module);
    const recovered = recoverCurriculumDraft(formRef.current, latestForm, latest.draft.version, keepChanges);
    if (submittedForm) recovered.form = reconcileSavedModule(submittedForm, formRef.current, latestForm);
    const latestSnapshot = moduleFormSnapshot(latestForm);
    initialFormRef.current = latestSnapshot;
    serverFormSnapshotRef.current = latestSnapshot;
    formRef.current = recovered.form;
    setForm(recovered.form);
    setDraftVersion(recovered.draftVersion);
    setServerView(latest);
    setConflict(null);
    setSaveError("");
    setPreviewData(activeTab === "preview" ? latest : null);
    queryClient.setQueryData(["admin", "modules", moduleId], latest);
    queryClient.setQueryData(["admin", "modules", Number(moduleId), "questions"], { questions: latest.questions, draftVersion: latest.draft.version });
    if (moduleFormSnapshot(recovered.form) !== latestSnapshot) writeEditorDraft(draftKey, recovered.form, latestSnapshot, recovered.draftVersion);
    else removeEditorDraft(draftKey);
    if (!keepChanges && !questionDirty) { setQuestionResetKey((key) => key + 1); setQuestionDirty(false); }
  };
  const recoverConflict = async (keepChanges) => {
    if (operationLockRef.current) return;
    operationLockRef.current = true; setOperationBusy(true);
    try {
      const latest = await nativeApi.admin.modules.detail(moduleId, "draft");
      acceptServerDraft(latest, keepChanges);
      if (!keepChanges) { setQuestionResetKey((key) => key + 1); setQuestionDirty(false); }
      toast({ title: keepChanges ? "Perubahan Anda dipertahankan" : "Draf terbaru dimuat",
        description: keepChanges ? "Tidak ada penggabungan otomatis. Periksa perubahan Anda; simpan berikutnya akan mengganti isi draf server dengan form Anda." : "Editor menggunakan draf terbaru dari server." });
    } catch (editorError) { setSaveError(editorError.message); }
    finally { endEditorialWrite(); }
  };
  const handleQuestionVersion = (version) => {
    setDraftVersion(version);
    setServerView((current) => ({ ...current, draft: { version, hasUnpublishedChanges: true } }));
    setPreviewData(null);
  };
  const mutateLifecycle = async (action, value) => {
    if ((action === "publish" || action === "copy") && (isDirtyRef.current || questionDirty)) return false;
    if (!beginEditorialWrite()) return false;
    const submittedForm = formRef.current;
    try {
      let result;
      if (action === "publish") {
        const published = await nativeApi.admin.modules.publishDraft(moduleId, draftVersion);
        result = published.module;
        acceptServerDraft(result, false, submittedForm);
      } else if (action === "copy") {
        result = await nativeApi.admin.modules.copyRevisionToDraft(moduleId, value, draftVersion);
        acceptServerDraft(result, false, submittedForm);
      } else {
        result = action === "archive" ? await nativeApi.admin.modules.archive(moduleId, value) : await nativeApi.admin.modules.restore(moduleId);
        setServerView((current) => ({ ...current, lifecycleStatus: result.lifecycleStatus, archivedAt: result.archivedAt, archiveReason: result.archiveReason }));
      }
      for (const queryKey of [["admin", "courses"], ["admin", "overview"], ["courseModules"], ["userProgress"], ["learning-profile"], ["quizQuestions"]]) {
        queryClient.invalidateQueries({ queryKey, refetchType: "all" });
      }
      toast({ title: { publish: "Revisi diterbitkan", copy: "Revisi disalin ke draf", archive: "Modul diarsipkan", restore: "Modul dipulihkan" }[action] });
      return true;
    } catch (editorError) { handleEditorialError(editorError); toast({ variant: "destructive", title: "Aksi belum berhasil", description: editorError.message }); return false; }
    finally { endEditorialWrite(); }
  };
  const loadServerPreview = async () => {
    if (isNew || previewLoading) return;
    const submittedContext = editorContextKey;
    setPreviewLoading(true); setPreviewError(""); setPreviewData(null);
    try {
      const result = await nativeApi.admin.modules.previewDraft(moduleId);
      if (currentEditorContextRef.current === submittedContext) setPreviewData(result);
    } catch (editorError) { setPreviewError(editorError.message); handleEditorialError(editorError); }
    finally { setPreviewLoading(false); }
  };
  const recoverValidation = (problem) => {
    if (problem.section === "questions") { setActiveTab("assessment"); requestAnimationFrame(() => document.getElementById("question-text")?.focus()); return; }
    setActiveTab("content");
    const fields = { title: "module-title", levelName: "module-level-name", content: "module-section-content", practicalAssignment: "module-section-practice" };
    requestAnimationFrame(() => { const target = document.getElementById(fields[problem.field] || "module-title"); target?.scrollIntoView({ block: "center" }); if (target?.matches("input,textarea,button")) target.focus(); else target?.querySelector("input,textarea,button,[contenteditable]")?.focus(); });
  };
  const previewForm = previewData ? moduleFormFromApi(previewData.module) : emptyModule;
  const applyCompanionDraft = (draft) => {
    if (!draft) return;
    setForm((current) => {
      const hasField = (field) => draft.fieldPresence?.[field] ?? true;
      const next = {
        ...current,
        ...(hasField("title") && draft.title ? { title: draft.title } : {}),
        ...(hasField("summary") && draft.summary ? { summary: draft.summary } : {}),
        ...(hasField("learningObjectives") ? { learningObjectives: draft.learningObjectives.join("\n") } : {}),
        ...(hasField("keyTakeaways") ? { keyTakeaways: draft.keyTakeaways.join("\n") } : {}),
        ...(hasField("checklist") ? { checklist: draft.checklist.join("\n") } : {}),
        ...(hasField("practicalAssignment") ? { practicalAssignment: draft.practicalAssignment } : {}),
      };
      const material = applyAiEditorialMaterial(current.editorialContent, current.content, draft.materialBlocks);
      if (material?.editorialContent) {
        next.editorialContent = material.editorialContent;
        if (material.content !== undefined) next.content = material.content;
      }
      formRef.current = next;
      return next;
    });
  };
  if ((!isNew && isLoading) || (isNew && isLoadingCourse))
    return (
      <AdminPageFrame title="Editor modul">
        <AdminLoading label="Memuat modul…" />
      </AdminPageFrame>
    );
  if (!isNew && error)
    return (
      <AdminPageFrame title="Editor modul">
        <AdminError error={error} onRetry={refetch} />
      </AdminPageFrame>
    );
  return (
    <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); if (tab === "preview") loadServerPreview(); }}>
      <AdminPageFrame
        editor
        title={isNew ? "Modul baru" : "Edit modul"}
        actions={(
          <>
            <TabsList className="aapm-editor-mode" aria-label="Mode editor">
              <TabsTrigger value="content" icon="edit">Konten</TabsTrigger>
              <TabsTrigger value="preview" icon="eye" disabled={isNew}>Pratinjau</TabsTrigger>
              <TabsTrigger value="assessment" icon="quiz" disabled={isNew}>Bank soal</TabsTrigger>
            </TabsList>
            <Button type="button" variant="secondary" onClick={() => requestNavigation(`/modules/${form.moduleNumber}`)} disabled={isNew || !serverView?.publishedRevisionId || serverView?.lifecycleStatus === "archived"}><AapmIcon name="eye" />Lihat di Academy</Button>
          </>
        )}
      >
        {conflict && <Surface className="mb-5 space-y-3 p-4" role="alert" tabIndex={-1} ref={conflictRef}>
          <h2 className="font-semibold">Draf berubah di server</h2>
          <p>Form dan draf browser Anda tetap dipertahankan. Muat ulang akan mengganti perubahan lokal dengan draf server. Pertahankan perubahan saya mengambil versi terbaru tanpa menggabungkan isi; simpan berikutnya mengganti draf server dengan form Anda.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={operationBusy} onClick={() => recoverConflict(false)}>Muat ulang draf terbaru</Button>
            <Button type="button" disabled={operationBusy} onClick={() => recoverConflict(true)}>Pertahankan perubahan saya</Button>
          </div>
          {saveError && <p>{saveError}</p>}
        </Surface>}
        {!isNew && editorReady && <CurriculumPublishingPanel key={moduleId} moduleId={moduleId} view={serverView} draftVersion={draftVersion}
          dirty={isDirty || questionDirty} changeKey={formSnapshot} conflict={conflict} busy={operationBusy}
          onMutation={mutateLifecycle} onError={handleEditorialError} onRecoverValidation={recoverValidation} />}
        <TabsContent value="content" className="aapm-editor-content">
          <form id="module-editor-form" onSubmit={save} onInvalid={handleInvalidField} className="aapm-editor-form aapm-editor-workspace">
            <EditorOutline
              asideRef={outlineDrawerRef}
              drawerOpen={drawer === "outline"}
              onClose={closeDrawer}
              sections={EDITOR_SECTIONS}
              activeSection={activeSection}
              onNavigate={(sectionId) => {
                closeDrawer();
                scrollToEditorSection(sectionId);
              }}
              blockSlotRef={setOutlineSlot}
              addGroups={editorialInsertGroups}
              onAddElement={(type) => editorialComposerRef.current?.addElement(type)}
            />
            <div className="aapm-editor-canvas">
              <header className="aapm-editor-doc-head">
                <div className="aapm-meta-row">
                  <button type="button" className="aapm-chip" data-hue={levelVisual(form.levelNumber).hue} onClick={() => openInspector("module")}>
                    <AapmIcon name="layers" />Chapter {form.levelNumber || "—"}{form.levelName ? ` · ${form.levelName}` : ""}
                  </button>
                  <button type="button" className="aapm-chip" data-tone="outline" onClick={() => openInspector("module")}>Modul {form.moduleNumber || "—"}</button>
                  {form.category ? <span className="aapm-chip" data-tone="outline">{form.category}</span> : null}
                </div>
                <label className="aapm-visually-hidden" htmlFor="module-title">Judul modul</label>
                <textarea
                  id="module-title"
                  className="aapm-editor-doc-title"
                  rows={1}
                  required
                  maxLength={200}
                  placeholder="Judul modul"
                  value={form.title}
                  onChange={(event) => set("title", event.target.value.replace(/\n/g, " "))}
                  onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                />
                <label className="aapm-visually-hidden" htmlFor="module-summary">Ringkasan modul</label>
                <textarea
                  id="module-summary"
                  className="aapm-editor-doc-summary"
                  rows={2}
                  placeholder="Ringkasan singkat: apa yang akan dikuasai learner di modul ini?"
                  value={form.summary}
                  onChange={(event) => set("summary", event.target.value)}
                />
              </header>
              <section id="module-section-content" className="aapm-editor-panel aapm-editor-section" data-active={activeSection === "module-section-content" ? "true" : "false"} aria-labelledby="editor-content-title">
                <header className="aapm-editor-panel__head">
                  <IconTile icon="lesson" hue="green" size="sm" shape="circle" />
                  <div className="min-w-0">
                    <h2 id="editor-content-title" className="aapm-editor-panel__title">Materi</h2>
                    <p className="aapm-editor-panel__description">Teks, gambar, slide, video, tabel, dan tautan — tersusun seperti yang dibaca learner.</p>
                  </div>
                </header>
                <EditorialComposer
                  ref={editorialComposerRef}
                  settingsContainer={blockInspectorNode}
                  outlineContainer={outlineSlot}
                  onSelectionChange={handleBlockSelection}
                  onOutlineSelect={closeDrawer}
                  value={form.editorialContent}
                  fallback={form.content}
                  legacyVideoUrl={form.videoUrl}
                  onChange={(editorialContent) => {
                    set("editorialContent", editorialContent);
                    // Once the Word-like canvas is edited, the legacy Markdown
                    // field must not remain as a hidden fallback.
                    set("content", "");
                  }}
                  onLegacyVideoChange={(videoUrl) => set("videoUrl", videoUrl)}
                />
              </section>

              <section id="module-section-outcomes" className="aapm-editor-panel aapm-editor-section" data-active={activeSection === "module-section-outcomes" ? "true" : "false"} aria-labelledby="editor-outcomes-title">
                <header className="aapm-editor-panel__head">
                  <IconTile icon="target" hue="orange" size="sm" shape="circle" />
                  <div className="min-w-0">
                    <h2 id="editor-outcomes-title" className="aapm-editor-panel__title">Tujuan & insight</h2>
                    <p className="aapm-editor-panel__description">Satu baris = satu poin. Tekan Enter untuk menambah poin baru.</p>
                  </div>
                </header>
                <div className="aapm-editor-outcome-grid">
                  <CompactListField
                    id="module-learning-objectives"
                    label="Tujuan pembelajaran"
                    icon="target"
                    value={form.learningObjectives}
                    onChange={(event) => set("learningObjectives", event.target.value)}
                  />
                  <CompactListField
                    id="module-key-takeaways"
                    label="Poin penting"
                    icon="insight"
                    tone="orange"
                    value={form.keyTakeaways}
                    onChange={(event) => set("keyTakeaways", event.target.value)}
                  />
                </div>
              </section>

              <section id="module-section-practice" className="aapm-editor-panel aapm-editor-section" data-active={activeSection === "module-section-practice" ? "true" : "false"} aria-labelledby="editor-practice-title">
                <header className="aapm-editor-panel__head">
                  <IconTile icon="practice" hue="teal" size="sm" shape="circle" />
                  <div className="min-w-0">
                    <h2 id="editor-practice-title" className="aapm-editor-panel__title">Praktik</h2>
                    <p className="aapm-editor-panel__description">Tugas yang dikerjakan di kandang dan checklist observasinya.</p>
                  </div>
                </header>
                <div className="aapm-editor-practice-fields">
                  <Field id="module-practical-assignment" label="Tugas praktik" hint="Satu tugas konkret yang dapat dikerjakan learner.">
                    <Textarea rows={4} value={form.practicalAssignment} onChange={(event) => set("practicalAssignment", event.target.value)} placeholder="Tulis tugas praktik…" />
                  </Field>
                  <CompactListField
                    id="module-checklist"
                    label="Checklist observasi"
                    icon="checkRead"
                    tone="orange"
                    value={form.checklist}
                    onChange={(event) => set("checklist", event.target.value)}
                  />
                  <Field id="module-video-script" label="Naskah video" hint="Opsional — tampil sebagai catatan instruktur di bawah video.">
                    <Textarea rows={3} value={form.videoScript} onChange={(event) => set("videoScript", event.target.value)} placeholder="Tulis catatan video…" />
                  </Field>
                </div>
              </section>
            </div>

            <aside ref={inspectorDrawerRef} className="aapm-editor-inspector" aria-label="Inspektor editor" role={drawer === "inspector" ? "dialog" : undefined} aria-modal={drawer === "inspector" ? true : undefined} tabIndex={drawer === "inspector" ? -1 : undefined} data-drawer-open={drawer === "inspector" ? "true" : undefined}>
              <div className="aapm-editor-inspector__head">
                <IconButton className="aapm-editor-drawer-close" label="Tutup inspektor" tooltip={false} icon="close" size="sm" onClick={closeDrawer} />
              </div>
              <div className="aapm-segmented aapm-inspector-tabs" role="tablist" aria-label="Panel inspektor">
                {INSPECTOR_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`inspector-tab-${tab.id}`}
                    aria-selected={inspectorTab === tab.id}
                    aria-controls={tab.id === "module" ? "module-section-identity" : `inspector-panel-${tab.id}`}
                    tabIndex={inspectorTab === tab.id ? 0 : -1}
                    className="aapm-tabs-trigger"
                    onClick={() => setInspectorTab(tab.id)}
                    onKeyDown={(event) => {
                      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                      event.preventDefault();
                      const index = INSPECTOR_TABS.findIndex((item) => item.id === tab.id);
                      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? INSPECTOR_TABS.length - 1
                        : (index + (event.key === "ArrowRight" ? 1 : -1) + INSPECTOR_TABS.length) % INSPECTOR_TABS.length;
                      const nextTab = INSPECTOR_TABS[nextIndex].id;
                      setInspectorTab(nextTab);
                      document.getElementById(`inspector-tab-${nextTab}`)?.focus();
                    }}
                  >
                    <AapmIcon name={tab.icon} />{tab.label}
                  </button>
                ))}
              </div>
              <section className="aapm-card" id="inspector-panel-block" role="tabpanel" aria-labelledby="inspector-tab-block" hidden={inspectorTab !== "block"}>
                <div className="aapm-card__header">
                  <h2 className="aapm-card__title">{selectedBlock ? "Pengaturan blok" : "Blok materi"}</h2>
                </div>
                <div className="aapm-card__content" ref={setBlockInspectorNode} />
              </section>
              <section className="aapm-card" id="module-section-identity" role="tabpanel" hidden={inspectorTab !== "module"} data-active={activeSection === "module-section-identity" ? "true" : "false"} aria-labelledby="inspector-tab-module">
                <div className="aapm-card__header">
                  <h2 id="editor-identity-title" className="aapm-card__title">Identitas modul</h2>
                  <p className="aapm-card__description">Posisi di kurikulum dan informasi di katalog learner.</p>
                </div>
                <div className="aapm-card__content grid gap-3" id="module-identity-fields">
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="module-level-number" label="No. chapter" required><Input type="number" min="1" max="20" value={form.levelNumber} onChange={(event) => {
                      const value = event.target.value;
                      const chapter = course?.curriculum?.find((level) => Number(level.levelNumber) === Number(value));
                      setSaveError("");
                      setForm((current) => {
                        const next = { ...current, levelNumber: value, ...(chapter ? { levelName: chapter.levelName } : {}) };
                        formRef.current = next;
                        return next;
                      });
                    }} /></Field>
                    <Field id="module-number" label="No. modul" required><Input type="number" min="1" max="999" readOnly={!isNew} value={form.moduleNumber} onChange={(event) => set("moduleNumber", event.target.value)} /></Field>
                  </div>
                  <Field id="module-level-name" label="Nama chapter" required><Input value={form.levelName} onChange={(event) => set("levelName", event.target.value)} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="module-category" label="Kategori"><Input value={form.category} onChange={(event) => set("category", event.target.value)} /></Field>
                    <Field id="module-order" label="Urutan roadmap"><Input type="number" min="0" value={form.order} onChange={(event) => set("order", event.target.value)} /></Field>
                  </div>
                  {!identityIsComplete ? <Alert tone="warning" title="Lengkapi field wajib" description="Chapter, nomor modul, dan judul diperlukan sebelum menyimpan." /> : null}
                </div>
              </section>

              <section className="aapm-card" aria-labelledby="editor-appearance-title" hidden={inspectorTab !== "module"}>
                <div className="aapm-card__header">
                  <h2 id="editor-appearance-title" className="aapm-card__title">Tampilan learner</h2>
                  <p className="aapm-card__description">Atur bagaimana tujuan dan praktik tampil di lesson.</p>
                </div>
                <div className="aapm-card__content grid gap-3">
                  <p className="aapm-text-overline m-0">Tujuan & insight</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="presentation-objectives-layout" label="Layout"><Select value={editorialPresentation.objectives.layout} onValueChange={(value) => setEditorialPresentation("objectives", "layout", value)}><SelectTrigger size="sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="columns">Dua kolom</SelectItem><SelectItem value="stacked">Satu kolom</SelectItem></SelectContent></Select></Field>
                    <Field id="presentation-objectives-density" label="Kepadatan"><Select value={editorialPresentation.objectives.density} onValueChange={(value) => setEditorialPresentation("objectives", "density", value)}><SelectTrigger size="sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Nyaman</SelectItem><SelectItem value="compact">Kompak</SelectItem></SelectContent></Select></Field>
                  </div>
                  <Field id="presentation-objectives-tone" label="Warna"><HueSelect value={editorialPresentation.objectives.tone} onChange={(value) => setEditorialPresentation("objectives", "tone", value)} /></Field>
                  <p className="aapm-text-overline m-0 mt-2">Praktik</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="presentation-practical-density" label="Kepadatan"><Select value={editorialPresentation.practical.density} onValueChange={(value) => setEditorialPresentation("practical", "density", value)}><SelectTrigger size="sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Nyaman</SelectItem><SelectItem value="compact">Kompak</SelectItem></SelectContent></Select></Field>
                    <Field id="presentation-practical-checklist" label="Checklist"><Select value={editorialPresentation.practical.checklistStyle} onValueChange={(value) => setEditorialPresentation("practical", "checklistStyle", value)}><SelectTrigger size="sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="checkbox">Interaktif</SelectItem><SelectItem value="list">Daftar ringkas</SelectItem></SelectContent></Select></Field>
                  </div>
                  <Field id="presentation-practical-tone" label="Warna"><HueSelect value={editorialPresentation.practical.tone} onChange={(value) => setEditorialPresentation("practical", "tone", value)} /></Field>
                </div>
              </section>

              <section className="aapm-card aapm-editor-ai" id="inspector-panel-ai" role="tabpanel" aria-labelledby="inspector-tab-ai" hidden={inspectorTab !== "ai"}>
                <div className="aapm-card__header">
                  <div className="flex items-center gap-2">
                    <IconTile icon="ai" hue="orange" size="xs" shape="circle" />
                    <h2 id="editor-ai-title" className="aapm-card__title">Bantuan APPI</h2>
                  </div>
                  <p className="aapm-card__description">Semua saran tampil sebagai pratinjau dan baru diterapkan setelah Anda setujui.</p>
                </div>
                <div className="aapm-card__content grid gap-3">
                  <AdminModuleCompanion key={editorContextKey} module={form} onApplyModule={applyCompanionDraft} />
                  <AiModuleDraft form={form} toast={toast} onApply={applyCompanionDraft} />
                </div>
              </section>
            </aside>
          </form>
          {drawer ? <button type="button" className="aapm-editor-drawer-scrim" tabIndex={-1} aria-label="Tutup panel" onClick={closeDrawer} /> : null}
          <EditorActionBar
            elementGroups={editorialInsertGroups}
            onOpenOutline={() => setDrawer("outline")}
            onOpenInspector={openInspector}
            onAddElement={(type) => editorialComposerRef.current?.addElement(type)}
            onSave={submitEditorForm}
            onRetry={submitEditorForm}
            isSaving={isSaving}
            isDirty={isDirty}
            saveError={saveError}
            savedAt={savedAt}
            disabled={operationBusy || Boolean(conflict)}
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-5">
          <p role="status" className="mb-3 text-sm">Pratinjau draf server tersimpan{previewData ? ` · v${previewData.draft.version}` : ""}. {isDirty || questionDirty ? "Perubahan lokal belum termasuk; simpan draf untuk memperbarui pratinjau." : ""}</p>
          <Button type="button" variant="secondary" disabled={previewLoading || operationBusy} onClick={loadServerPreview}>Muat ulang pratinjau</Button>
          {previewLoading && <AdminLoading label="Memuat pratinjau draf…" />}
          {previewError && <p role="alert">{previewError}</p>}
          {previewData && <>
          <Surface className="p-3 sm:p-5 lg:p-7">
            <div className="mx-auto max-w-[1280px]">
              <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-xl font-semibold">{previewForm.title || "Pratinjau materi"}</h2>
                {previewForm.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{previewForm.summary}</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-5 lg:p-7">
                <EditorialContent document={previewForm.editorialContent} fallback={previewForm.content} title={previewForm.title || "Materi modul"} />
                {!hasEditorialVideo(previewForm.editorialContent) && previewForm.videoUrl.trim() && (
                  <div className="mt-7 border-t border-border pt-7">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Video materi</p>
                    <LessonMedia module={{ title: previewForm.title || "Video", videoUrl: previewForm.videoUrl }} />
                    {previewForm.videoScript && <p className="mt-3 rounded-xl bg-surface-subtle p-4 text-sm leading-6 text-muted-foreground">{previewForm.videoScript}</p>}
                  </div>
                )}
                <div className="mt-7 space-y-8 border-t border-border pt-7">
                  <LessonStructuredContent
                    module={{
                      ...previewForm,
                      learningObjectives: textToList(previewForm.learningObjectives),
                      keyTakeaways: textToList(previewForm.keyTakeaways),
                      checklist: textToList(previewForm.checklist),
                    }}
                    document={previewForm.editorialContent}
                    withSectionIds={false}
                  />
                </div>
              </div>
            </div>
          </Surface>
          </>}
        </TabsContent>
        <TabsContent value="assessment" forceMount hidden={activeTab !== "assessment"} className="mt-5 aapm-editor-content">
          {!isNew && <QuestionEditor key={moduleId} moduleId={Number(moduleId)} draftVersion={draftVersion} busy={operationBusy} conflict={conflict}
            beginWrite={beginEditorialWrite} endWrite={endEditorialWrite} onVersion={handleQuestionVersion} onError={handleEditorialError}
            onDirty={setQuestionDirty} resetKey={questionResetKey} />}
        </TabsContent>
      </AdminPageFrame>
      <ConfirmDialog
        open={Boolean(pendingDraft)}
        onOpenChange={(open) => {
          if (!open) {
            removeEditorDraft(pendingDraft?.key);
            setPendingDraft(null);
          }
        }}
        title="Draft lokal ditemukan"
        description={pendingDraft?.stale ? "Draf lokal berasal dari versi server sebelumnya. Pulihkan untuk mempertahankan perubahan Anda, lalu pilih pemulihan konflik secara eksplisit sebelum menyimpan. Tidak ada penggabungan otomatis." : "Ada perubahan lokal yang belum tersimpan untuk modul ini. Pulihkan draft untuk melanjutkan dari titik terakhir atau buang draft tersebut."}
        confirmLabel="Pulihkan draft"
        cancelLabel="Buang draft"
        icon="history"
        onConfirm={() => {
           const draft = pendingDraft;
           if (!draft) return;
           setForm(draft.form);
           formRef.current = draft.form;
          if (draft.stale) handleEditorialError({ status: 409, code: "revision_conflict", message: "Draf browser berasal dari versi sebelumnya." });
          setPendingDraft(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingNavigation)}
        onOpenChange={(open) => !open && clearNavigationPrompt()}
        title="Tinggalkan editor?"
        description="Perubahan belum disimpan. Jika Anda keluar sekarang, draft aman akan tetap disimpan di browser dan dapat dipulihkan saat editor ini dibuka lagi."
        confirmLabel="Tinggalkan tanpa simpan"
        cancelLabel="Tetap di editor"
        icon="logout"
        onConfirm={() => {
          const request = pendingNavigationRef.current || pendingNavigation;
          clearNavigationPrompt();
          if (!request) return;
          if (request.type === "history-back") {
            const guard = historyGuardRef.current;
            if (guard?.active) {
              guard.allowPop = true;
              window.history.go(-2);
            }
            return;
          }
          releaseHistoryGuard();
          if (request.target) navigate(request.target);
        }}
      />
    </Tabs>
  );
}
