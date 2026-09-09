// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { nativeApi } from "@/api/nativeClient";
import AapmIcon from "@/components/icons/AapmIcon";
import { EditorialContent } from "@/components/academy/EditorialContent";
import { LessonStructuredContent } from "@/components/academy/LessonStructuredContent";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import EditorialComposer, { editorialInsertActions } from "@/components/admin/EditorialComposer";
import EditorQuickNav from "@/components/admin/EditorQuickNav";
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
} from "@/components/primitives";
import {
  AdminError,
  AdminLoading,
  AdminPageFrame,
} from "@/components/admin/AdminPage";
import {
  useAdminModule,
  useAdminModuleQuestions,
  useCreateAdminModule,
  useDeleteAdminModule,
  useDeleteAdminQuestion,
  useAdminAiSettings,
  useSaveAdminQuestion,
  useUpdateAdminModule,
} from "@/lib/useAdminData";
import { hasEditorialVideo, normaliseEditorialPresentation, parseEditorialDocument } from "@/lib/editorialDocument";
import { useAuth } from "@/lib/AuthContext";

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

function normaliseAiModuleDraft(value) {
  if (!value || typeof value !== "object") return null;
  const draft = {
    learningObjectives: aiList(value.learningObjectives),
    keyTakeaways: aiList(value.keyTakeaways),
    checklist: aiList(value.checklist),
    practicalAssignment: typeof value.practicalAssignment === "string"
      ? value.practicalAssignment.trim().slice(0, 1200)
      : "",
  };
  return draft.learningObjectives.length || draft.keyTakeaways.length || draft.checklist.length || draft.practicalAssignment
    ? draft
    : null;
}

function parseAiModuleDraft(reply) {
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
      const parsed = normaliseAiModuleDraft(JSON.parse(candidate));
      if (parsed) return parsed;
    } catch {
      // APPI may wrap JSON in a short explanation; try the next candidate.
    }
  }
  return null;
}

function editorialContextForAi(form) {
  const document = parseEditorialDocument(form?.editorialContent);
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const blockText = blocks
    .flatMap((block) => [block?.title, block?.content, block?.caption, block?.description, block?.label])
    .filter(Boolean)
    .join("\n")
    .slice(0, 2600);
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
    <div className="aapm-editor-point-card aapm-token-card min-w-0 border border-border bg-background p-3">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone === "orange" ? "bg-tint-orange text-brand-orange" : "bg-tint-green text-brand-green"}`}>
          <AapmIcon name={icon} className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-point-1`} className="text-xs font-semibold">{label}</Label>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Satu baris = satu poin learner</p>
        </div>
        <Badge variant="soft" className="shrink-0 text-[10px]">{count} poin</Badge>
      </div>
      <div className="aapm-editor-point-list space-y-1.5" role="list" aria-label={`${label} untuk learner`}>
        {points.map((point, index) => (
          <div key={`${id}-point-${index + 1}`} className="aapm-editor-point-row flex min-w-0 items-center gap-1.5 rounded-[var(--radius-control)] p-1" role="listitem">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${tone === "orange" ? "bg-tint-orange text-brand-orange" : "bg-tint-green text-brand-green"}`} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
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
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-sm shadow-none focus-visible:ring-0"
              placeholder={`Tulis poin ${index + 1}…`}
              aria-label={`${label}, poin ${index + 1}`}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-danger"
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
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">Nomor mengikuti urutan tampil di learner.</span>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => insertPointAfter(points.length - 1)}>
          <AapmIcon name="add" className="h-3.5 w-3.5" /> Tambah poin
        </Button>
      </div>
    </div>
  );
}

function AiModuleDraft({ form, onApply, toast }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
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
          '{"learningObjectives":["maksimal 3 tujuan"],"keyTakeaways":["maksimal 3 poin penting"],"checklist":["maksimal 3 cek observasi"],"practicalAssignment":"satu tugas praktik singkat"}',
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

  const applyDraft = () => {
    if (!draft) return;
    onApply(draft);
    setDraft(null);
    toast({ title: "Draf APPI diterapkan", description: "Tinjau poin-poinnya sebelum menyimpan modul." });
  };

  return (
    <div className="aapm-token-card border border-brand-orange/25 bg-tint-orange/35 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-brand-orange">
          <AapmIcon name="ai" className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Bantu isi dengan APPI</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Buat draf tujuan, insight, tugas, dan checklist tanpa menimpa isi sebelum Anda menyetujuinya.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <Badge variant="soft" className={`max-w-full truncate text-[10px] ${providerStatus.className}`}>
            <AapmIcon name={providerStatus.icon} className={`h-3 w-3 ${providerStatus.icon === "refresh" ? "animate-spin" : ""}`} />
            {providerStatus.label}
          </Badge>
          {providerReady === false && <Link to="/admin/ai-settings" className="text-[10px] font-semibold text-brand-orange hover:underline">Buka Pengaturan AI</Link>}
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
              disabled={isGenerating}
            />
            <Button type="button" size="sm" className="h-9 shrink-0" onClick={generate} disabled={isGenerating || !String(form?.title || form?.summary || "").trim()}>
              <AapmIcon name={isGenerating ? "refresh" : "ai"} className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Menyusun…" : "Generate"}
            </Button>
          </div>
          {draft && (
            <div className="mt-3 rounded-[var(--radius-control)] border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">Pratinjau draf</p>
                <Badge variant="soft" className="text-[10px]">Belum diterapkan</Badge>
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
        </div>
      )}
    </div>
  );
}

const editorDraftPrefix = "aapm:academy:module-editor:v1";

const moduleFormSnapshot = (value) => JSON.stringify(value || {});

const EDITOR_SECTIONS = [
  {
    id: "module-section-identity",
    label: "Identitas",
    shortLabel: "Struktur",
    detail: "Chapter, nomor, judul, dan ringkasan",
    icon: "course",
  },
  {
    id: "module-section-content",
    label: "Materi & media",
    shortLabel: "Materi",
    detail: "Teks, slide, gambar, dan video",
    icon: "edit",
  },
  {
    id: "module-section-outcomes",
    label: "Outcome",
    shortLabel: "Outcome",
    detail: "Tujuan, poin penting, checklist",
    icon: "checkRead",
  },
  {
    id: "module-section-practice",
    label: "Praktik",
    shortLabel: "Praktik",
    detail: "Tugas dan naskah video",
    icon: "target",
  },
];

function moduleFormFromApi(module) {
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

function writeEditorDraft(key, form, serverSnapshot = "") {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({
      version: 2,
      savedAt: new Date().toISOString(),
      serverSnapshot,
      form,
    }));
  } catch {
    // Storage failures must not block the editor.
  }
}

function QuestionEditor({ moduleId }) {
  const { data, isLoading } = useAdminModuleQuestions(moduleId);
  const saveQuestion = useSaveAdminQuestion();
  const deleteQuestion = useDeleteAdminQuestion();
  const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [pendingQuestionDelete, setPendingQuestionDelete] = useState(null);
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
    try {
      await saveQuestion.mutateAsync({
        moduleId,
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
      setSelected(null);
      setForm(emptyQuestion);
      toast({ title: "Soal disimpan" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Soal belum disimpan",
        description: error.message,
      });
    }
  };
  const remove = async (question) => {
    try {
      await deleteQuestion.mutateAsync({ moduleId, questionId: question.id });
      if (selected?.id === question.id) {
        setSelected(null);
        setForm(emptyQuestion);
      }
      toast({ title: "Soal dihapus" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Soal belum dihapus",
        description: error.message,
      });
    }
  };
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
      <Surface className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Bank soal</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pilihan ganda untuk modul ini.
            </p>
          </div>
          <Badge
            variant="soft"
            className="bg-tint-orange text-tint-orange-foreground"
          >
            {questions.length} soal
          </Badge>
        </div>
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
                    aria-label="Edit soal"
                  >
                    <AapmIcon name="edit" className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPendingQuestionDelete(question)}
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
      </Surface>
      <Surface className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {selected ? "Edit soal" : "Tambah soal"}
          </h2>
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
        </div>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Pertanyaan</Label>
            <Textarea
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
              <Label>{label}</Label>
              <Input
                value={form[key]}
                onChange={(event) => set(key, event.target.value)}
                required={key === "optionA" || key === "optionB"}
              />
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Jawaban benar</Label>
              <Select
                value={form.correctIndex}
                onValueChange={(value) => set("correctIndex", value)}
              >
                <SelectTrigger>
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
              <Label>Kesulitan</Label>
              <Select
                value={form.difficulty}
                onValueChange={(value) => set("difficulty", value)}
              >
                <SelectTrigger>
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
            <Label>Penjelasan</Label>
            <Textarea
              value={form.explanation}
              onChange={(event) => set("explanation", event.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tujuan pembelajaran</Label>
            <Input
              value={form.learningObjective}
              onChange={(event) => set("learningObjective", event.target.value)}
            />
          </div>
          <Button
            className="w-full"
            type="submit"
            disabled={saveQuestion.isPending}
          >
            {saveQuestion.isPending
              ? "Menyimpan…"
              : selected
                ? "Simpan soal"
                : "Tambah soal"}
          </Button>
        </form>
      </Surface>
      </div>
      <ConfirmDialog
        open={Boolean(pendingQuestionDelete)}
        onOpenChange={(open) => !open && setPendingQuestionDelete(null)}
        title="Hapus soal?"
        description="Soal ini akan dihapus dari bank soal modul dan tidak dapat dipulihkan."
        confirmLabel="Hapus soal"
        icon="solar:trash-bin-trash-bold"
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
  const isNew = moduleId === "new";
  const newModuleParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isNewChapter = isNew && newModuleParams.get("newChapter") === "1";
  const newModuleDefaults = useMemo(() => {
    if (!isNew) return emptyModule;
    const levelNumber = Number(newModuleParams.get("levelNumber"));
    const levelName = newModuleParams.get("levelName");
    return {
      ...emptyModule,
      ...(Number.isInteger(levelNumber) && levelNumber >= 1 && levelNumber <= 20 ? { levelNumber } : {}),
      ...(levelName ? { levelName } : {}),
      ...(isNewChapter ? { levelName: "Chapter baru" } : {}),
    };
  }, [isNew, isNewChapter, newModuleParams]);
  const accountId = user?.id ? String(user.id) : "";
  const editorModuleId = isNew ? "new" : moduleId;
  const { data, isLoading, error, refetch } = useAdminModule(
    isNew ? null : moduleId,
  );
  const createModule = useCreateAdminModule();
  const updateModule = useUpdateAdminModule();
  const deleteModule = useDeleteAdminModule();
  const [form, setForm] = useState(emptyModule);
  const [pendingModuleDelete, setPendingModuleDelete] = useState(false);
  const [pendingModuleDeleteWithProgress, setPendingModuleDeleteWithProgress] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [editorReady, setEditorReady] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [activeSection, setActiveSection] = useState(EDITOR_SECTIONS[0].id);
  const [identityExpanded, setIdentityExpanded] = useState(isNew);
  const initialFormRef = useRef(JSON.stringify(emptyModule));
  const serverFormSnapshotRef = useRef(moduleFormSnapshot(emptyModule));
  const editorContextRef = useRef("");
  const formRef = useRef(form);
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
  const draftKeyRef = useRef(draftKey);
  const formSnapshot = useMemo(() => moduleFormSnapshot(form), [form]);
  const isDirty = editorReady && formSnapshot !== initialFormRef.current;
  const editorialVideoIsPresent = hasEditorialVideo(form.editorialContent);
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
    formRef.current = form;
    draftKeyRef.current = draftKey;
    isDirtyRef.current = isDirty;
  }, [draftKey, form, isDirty]);

  useEffect(() => {
    setIdentityExpanded(isNew);
  }, [editorContextKey, isNew]);

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
    if (!accountId || (!isNew && !module)) return;
    if (editorContextRef.current === editorContextKey) return;

    const nextForm = isNew ? { ...newModuleDefaults } : moduleFormFromApi(module);
    const nextServerSnapshot = moduleFormSnapshot(nextForm);
    editorContextRef.current = editorContextKey;
    serverFormSnapshotRef.current = nextServerSnapshot;
    initialFormRef.current = nextServerSnapshot;
    setForm(nextForm);
    formRef.current = nextForm;
    setEditorReady(true);

    const draft = readEditorDraft(draftKey);
    const draftSnapshot = draft ? moduleFormSnapshot(draft.form) : "";
    const draftMatchesCurrentServer = draft?.serverSnapshot
      ? draft.serverSnapshot === nextServerSnapshot
      : false;
    if (
      draft &&
      draftSnapshot !== nextServerSnapshot &&
      (!draft.serverSnapshot || draftMatchesCurrentServer)
    ) {
      setPendingDraft({ key: draftKey, ...draft });
    } else {
      removeEditorDraft(draftKey);
      setPendingDraft(null);
    }
  }, [accountId, data, draftKey, editorContextKey, isNew, newModuleDefaults]);

  useEffect(() => {
    if (!editorReady || !isDirty || !draftKey) return undefined;
    const timeoutId = window.setTimeout(
      () => writeEditorDraft(draftKey, form, serverFormSnapshotRef.current),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [draftKey, editorReady, form, isDirty]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      writeEditorDraft(
        draftKeyRef.current,
        formRef.current,
        serverFormSnapshotRef.current,
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
        if (section.id === "module-section-identity") setIdentityExpanded(true);
        window.requestAnimationFrame(() => {
          document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };

    window.addEventListener("keydown", handleEditorShortcut);
    return () => window.removeEventListener("keydown", handleEditorShortcut);
  }, [isSaving]);

  const set = (key, value) =>
    setForm((current) => {
      const next = { ...current, [key]: value };
      formRef.current = next;
      return next;
    });
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
    );
    promptNavigation({ target, type: "route" });
  };
  const scrollToEditorSection = (sectionId) => {
    setActiveTab("content");
    setActiveSection(sectionId);
    if (sectionId === "module-section-identity") setIdentityExpanded(true);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const toggleIdentity = () => {
    if (identityExpanded && !identityIsComplete) return;
    setIdentityExpanded((open) => !open);
  };
  const submitEditorForm = () => {
    if (!isSaving) document.getElementById("module-editor-form")?.requestSubmit();
  };
  const save = async (event) => {
    event.preventDefault();
    if (editorialComposerRef.current?.validate?.() === false) {
      toast({
        variant: "destructive",
        title: "Lengkapi blok materi terlebih dahulu",
        description: "Periksa kartu kualitas di Materi utama, lalu lengkapi blok yang ditandai.",
      });
      return;
    }
    const payload = {
      ...form,
      levelNumber: Number(form.levelNumber),
      moduleNumber: Number(form.moduleNumber),
      order: Number(form.order || 0),
      learningObjectives: textToList(form.learningObjectives),
      keyTakeaways: textToList(form.keyTakeaways),
      checklist: textToList(form.checklist),
    };
    if (!isNew && payload.videoUrl === (data?.module?.videoUrl || "")) {
      delete payload.videoUrl;
    }
    try {
      const result = isNew
        ? await createModule.mutateAsync(payload)
        : await updateModule.mutateAsync({ moduleId, data: payload });
      const saved = result?.module || result;
      toast({
        title: "Modul disimpan",
        description: "Perubahan langsung dipakai oleh Academy.",
      });
      const savedForm = saved?.id ? moduleFormFromApi(saved) : form;
      const savedSnapshot = moduleFormSnapshot(savedForm);
      serverFormSnapshotRef.current = savedSnapshot;
      initialFormRef.current = savedSnapshot;
      setForm(savedForm);
      formRef.current = savedForm;
      removeEditorDraft(draftKey);
      setEditorReady(true);
      releaseHistoryGuard();
      if (isNew && saved?.id)
        navigate(`/admin/courses/${courseId}/modules/${saved.id}`, {
          replace: true,
        });
    } catch (saveError) {
      toast({
        variant: "destructive",
        title: "Modul belum disimpan",
        description: saveError.message,
      });
    }
  };
  const remove = async ({ purgeProgress = false } = {}) => {
    try {
      await deleteModule.mutateAsync({ moduleId, purgeProgress });
      toast({
        title: "Modul dihapus",
        description: purgeProgress
          ? "Bank soal dan seluruh progress pada modul ini ikut dihapus."
          : undefined,
      });
      removeEditorDraft(draftKey);
      releaseHistoryGuard();
      navigate(`/admin/courses/${courseId}`);
    } catch (deleteError) {
      if (!purgeProgress && deleteError?.code === "module_has_progress") {
        setPendingModuleDeleteWithProgress(true);
        return;
      }
      toast({
        variant: "destructive",
        title: "Modul belum dihapus",
        description: deleteError.message,
      });
    }
  };
  if (!isNew && isLoading)
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
    <AdminPageFrame
      editor
      title={isNew ? "Tambah modul" : `Edit modul ${form.moduleNumber || ""}`}
      description="Kelola isi modul, media, dan evaluasi."
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => requestNavigation(`/admin/courses/${courseId}`)}>
            <AapmIcon name="arrowLeft" className="h-4 w-4" /> Kurikulum
          </Button>
          {!isNew && (
            <Button
              variant="outline"
              onClick={() => setPendingModuleDelete(true)}
              disabled={deleteModule.isPending}
            >
              <AapmIcon name="delete" className="h-4 w-4 text-danger" /> Hapus
            </Button>
          )}
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="aapm-editor-mode-tabs aapm-scrollbar h-auto w-full justify-start gap-1 overflow-x-auto rounded-[var(--radius-control)] bg-surface-subtle/60 p-1">
          <TabsTrigger value="content" className="rounded-[var(--radius-control)] border-0 px-3 py-1.5 text-xs shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Konten modul</TabsTrigger>
          <TabsTrigger value="preview" className="rounded-[var(--radius-control)] border-0 px-3 py-1.5 text-xs shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Pratinjau learner</TabsTrigger>
          <TabsTrigger value="assessment" disabled={isNew} className="rounded-[var(--radius-control)] border-0 px-3 py-1.5 text-xs shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            Bank soal
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-4">
          <div className="space-y-3">
            <EditorQuickNav
              sections={EDITOR_SECTIONS}
              activeSection={activeSection}
              onNavigate={scrollToEditorSection}
              onPreview={() => setActiveTab("preview")}
              onSave={submitEditorForm}
              isSaving={isSaving}
              elementItems={editorialInsertActions}
              onAddElement={(type) => editorialComposerRef.current?.addElement(type)}
            />
            <form id="module-editor-form" onSubmit={save} className="space-y-5">
            <section id="module-section-identity" className="aapm-editor-section scroll-mt-24 border-b border-border" data-active={activeSection === "module-section-identity" ? "true" : "false"}>
              <div className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">01 · Struktur</div>
                  <h2 className="mt-1 line-clamp-2 text-base font-semibold">{form.title || "Identitas modul"}</h2>
                  {form.summary && <p className="mt-1 hidden line-clamp-1 text-xs leading-5 text-muted-foreground sm:block">{form.summary}</p>}
                </div>
                <div className="flex items-center justify-start lg:justify-end">
                  <Button type="button" size="sm" variant={identityExpanded ? "ghost" : "outline"} className="shrink-0" aria-expanded={identityExpanded} aria-controls="module-identity-fields" onClick={toggleIdentity}>
                    <AapmIcon name={identityExpanded ? "chevronUp" : "edit"} className="h-3.5 w-3.5" />
                    <span className="sm:hidden">{identityExpanded ? "Tutup" : "Edit"}</span>
                    <span className="hidden sm:inline">{identityExpanded ? "Ringkaskan" : "Ubah identitas"}</span>
                  </Button>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border py-3 sm:grid-cols-4">
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Chapter</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.levelNumber || "—"}{form.levelName ? ` · ${form.levelName}` : ""}</dd></div>
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Modul</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.moduleNumber || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Roadmap</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.order === "" ? "—" : form.order}</dd></div>
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Kategori</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.category || "—"}</dd></div>
              </dl>
              {identityExpanded && <div id="module-identity-fields" className="border-t border-border bg-surface-subtle/45 py-4">
                {!identityIsComplete && <div className="mb-3 flex justify-end"><span className="text-[10px] text-brand-orange">Lengkapi field wajib sebelum ditutup.</span></div>}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Nomor chapter</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={form.levelNumber}
                      onChange={(event) => set("levelNumber", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nama chapter</Label>
                    <Input
                      value={form.levelName}
                      onChange={(event) => set("levelName", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nomor modul</Label>
                    <Input
                      type="number"
                      min="1"
                      max="999"
                      value={form.moduleNumber}
                      onChange={(event) =>
                        set("moduleNumber", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Urutan modul di roadmap</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.order}
                      onChange={(event) => set("order", event.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Judul modul</Label>
                    <Input
                      value={form.title}
                      onChange={(event) => set("title", event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kategori</Label>
                    <Input
                      value={form.category}
                      onChange={(event) => set("category", event.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label>Ringkasan</Label>
                  <Textarea
                    rows={2}
                    value={form.summary}
                    onChange={(event) => set("summary", event.target.value)}
                  />
                </div>
              </div>}
            </section>
            <section id="module-section-content" className="aapm-editor-section scroll-mt-24" data-active={activeSection === "module-section-content" ? "true" : "false"}>
              <h2 className="mb-3 text-base font-semibold">Materi utama</h2>
              <EditorialComposer
                ref={editorialComposerRef}
                value={form.editorialContent}
                fallback={form.content}
                legacyVideoUrl={form.videoUrl}
                onChange={(editorialContent) => {
                  set("editorialContent", editorialContent);
                  // Once the Word-like canvas is edited, the legacy Markdown
                  // field must not remain as a hidden fallback. In
                  // particular, clearing the last block must clear old
                  // content too, otherwise learner view appears unchanged.
                  set("content", "");
                }}
                onLegacyVideoChange={(videoUrl) => set("videoUrl", videoUrl)}
              />
              <div id="module-section-outcomes" className="aapm-editor-section mt-4 scroll-mt-24 space-y-3" data-active={activeSection === "module-section-outcomes" ? "true" : "false"}>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Tujuan & insight</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Edit poin learner langsung. Satu poin per baris.</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Konten utama</Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
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
                    icon="info"
                    value={form.keyTakeaways}
                    onChange={(event) => set("keyTakeaways", event.target.value)}
                  />
                  <CompactListField
                    id="module-checklist"
                    label="Checklist praktik"
                    icon="checkRead"
                    tone="orange"
                    value={form.checklist}
                    onChange={(event) => set("checklist", event.target.value)}
                  />
                </div>
                <AiModuleDraft
                  form={form}
                  toast={toast}
                  onApply={(draft) => {
                    set("learningObjectives", draft.learningObjectives.join("\n"));
                    set("keyTakeaways", draft.keyTakeaways.join("\n"));
                    set("checklist", draft.checklist.join("\n"));
                    set("practicalAssignment", draft.practicalAssignment);
                  }}
                />
                <details className="rounded-[var(--radius-control)] border border-border bg-surface-subtle/45">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold [&::-webkit-details-marker]:hidden">
                    <AapmIcon name="settings" className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">Tampilan tujuan & insight</span>
                    <span className="text-[10px] font-normal text-muted-foreground">opsional</span>
                    <AapmIcon name="chevronDown" className="h-3.5 w-3.5 text-muted-foreground" />
                  </summary>
                  <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label>Layout</Label><Select value={editorialPresentation.objectives.layout} onValueChange={(value) => setEditorialPresentation("objectives", "layout", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="columns">Dua kolom</SelectItem><SelectItem value="stacked">Satu kolom</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label>Aksen warna</Label><Select value={editorialPresentation.objectives.tone} onValueChange={(value) => setEditorialPresentation("objectives", "tone", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="neutral">Netral</SelectItem><SelectItem value="green">Hijau</SelectItem><SelectItem value="orange">Orange</SelectItem><SelectItem value="blue">Biru</SelectItem><SelectItem value="violet">Violet</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label>Kepadatan</Label><Select value={editorialPresentation.objectives.density} onValueChange={(value) => setEditorialPresentation("objectives", "density", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Nyaman</SelectItem><SelectItem value="compact">Kompak</SelectItem></SelectContent></Select></div>
                  </div>
                </details>
              </div>
              <div id="module-section-practice" className="aapm-editor-section mt-4 scroll-mt-24 space-y-3" data-active={activeSection === "module-section-practice" ? "true" : "false"}>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="aapm-editor-point-card aapm-token-card min-w-0 border border-border bg-background p-3">
                    <Label htmlFor="module-practical-assignment" className="text-xs font-semibold">Tugas praktik</Label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Satu tugas yang dapat dikerjakan learner.</p>
                    <Textarea id="module-practical-assignment" rows={3} className="mt-2 min-h-[6.25rem] resize-y text-sm" value={form.practicalAssignment} onChange={(event) => set("practicalAssignment", event.target.value)} placeholder="Tulis tugas praktik…" />
                  </div>
                  <div className="aapm-editor-point-card aapm-token-card min-w-0 border border-border bg-background p-3">
                    <Label htmlFor="module-video-script" className="text-xs font-semibold">Naskah video</Label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Opsional, tampil sebagai pendamping video.</p>
                    <Textarea id="module-video-script" rows={3} className="mt-2 min-h-[6.25rem] resize-y text-sm" value={form.videoScript} onChange={(event) => set("videoScript", event.target.value)} placeholder="Tulis catatan video…" />
                  </div>
                </div>
                <details className="rounded-[var(--radius-control)] border border-border bg-surface-subtle/45">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold [&::-webkit-details-marker]:hidden">
                    <AapmIcon name="settings" className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">Tampilan praktik & checklist</span>
                    <span className="text-[10px] font-normal text-muted-foreground">opsional</span>
                    <AapmIcon name="chevronDown" className="h-3.5 w-3.5 text-muted-foreground" />
                  </summary>
                  <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label>Aksen kartu</Label><Select value={editorialPresentation.practical.tone} onValueChange={(value) => setEditorialPresentation("practical", "tone", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="green">Hijau</SelectItem><SelectItem value="orange">Orange</SelectItem><SelectItem value="blue">Biru</SelectItem><SelectItem value="violet">Violet</SelectItem><SelectItem value="neutral">Netral</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label>Kepadatan</Label><Select value={editorialPresentation.practical.density} onValueChange={(value) => setEditorialPresentation("practical", "density", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comfortable">Nyaman</SelectItem><SelectItem value="compact">Kompak</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label>Gaya checklist</Label><Select value={editorialPresentation.practical.checklistStyle} onValueChange={(value) => setEditorialPresentation("practical", "checklistStyle", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="checkbox">Checkbox interaktif</SelectItem><SelectItem value="list">Daftar ringkas</SelectItem></SelectContent></Select></div>
                  </div>
                </details>
              </div>
            </section>
            <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t border-border bg-background/95 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSaving ? "animate-pulse bg-brand-orange" : isDirty ? "bg-brand-orange" : "bg-brand-green"}`} aria-hidden="true" />
                <span className="truncate">{isSaving ? "Menyimpan…" : isDirty ? "Ada perubahan belum disimpan" : "Semua perubahan tersimpan"}</span>
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
                {isSaving ? "Menyimpan…" : "Simpan modul"}
                <AapmIcon name={isSaving ? "refresh" : "checkRead"} className={isSaving ? "animate-spin" : undefined} />
              </Button>
            </div>
            </form>
          </div>
        </TabsContent>
        <TabsContent value="preview" className="mt-5">
          <Surface className="p-3 sm:p-5 lg:p-7">
            <div className="mx-auto max-w-[1280px]">
              <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-xl font-semibold">{form.title || "Pratinjau materi"}</h2>
                {form.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{form.summary}</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-5 lg:p-7">
                <EditorialContent document={form.editorialContent} fallback={form.content} title={form.title || "Materi modul"} />
                {!editorialVideoIsPresent && form.videoUrl.trim() && (
                  <div className="mt-7 border-t border-border pt-7">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Video materi</p>
                    <LessonMedia module={{ title: form.title || "Video", videoUrl: form.videoUrl }} />
                    {form.videoScript && <p className="mt-3 rounded-xl bg-surface-subtle p-4 text-sm leading-6 text-muted-foreground">{form.videoScript}</p>}
                  </div>
                )}
                <div className="mt-7 space-y-8 border-t border-border pt-7">
                  <LessonStructuredContent
                    module={{
                      ...form,
                      learningObjectives: textToList(form.learningObjectives),
                      keyTakeaways: textToList(form.keyTakeaways),
                      checklist: textToList(form.checklist),
                    }}
                    document={form.editorialContent}
                    withSectionIds={false}
                  />
                </div>
              </div>
            </div>
          </Surface>
        </TabsContent>
        <TabsContent value="assessment" className="mt-5">
          {!isNew && <QuestionEditor moduleId={Number(moduleId)} />}
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={Boolean(pendingDraft)}
        onOpenChange={(open) => {
          if (!open) {
            removeEditorDraft(pendingDraft?.key);
            setPendingDraft(null);
          }
        }}
        title="Draft lokal ditemukan"
        description="Ada perubahan lokal yang belum tersimpan untuk modul ini. Pulihkan draft untuk melanjutkan dari titik terakhir atau buang draft tersebut."
        confirmLabel="Pulihkan draft"
        cancelLabel="Buang draft"
        icon="solar:history-bold-duotone"
        onConfirm={() => {
           const draft = pendingDraft;
           if (!draft) return;
           setForm(draft.form);
           formRef.current = draft.form;
          removeEditorDraft(draft.key);
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
        icon="solar:logout-2-bold-duotone"
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
      <ConfirmDialog
        open={pendingModuleDelete}
        onOpenChange={setPendingModuleDelete}
        title="Hapus modul?"
        description={`Modul dan seluruh bank soalnya akan dihapus. ${isDirty ? "Perubahan yang belum disimpan juga akan dibuang setelah Anda mengonfirmasi. " : ""}Jika modul memiliki progres learner, sistem akan meminta konfirmasi tambahan sebelum ikut menghapus progres tersebut.`}
        confirmLabel="Hapus modul"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={() => {
          setPendingModuleDelete(false);
          remove();
        }}
      />
      <ConfirmDialog
        open={pendingModuleDeleteWithProgress}
        onOpenChange={setPendingModuleDeleteWithProgress}
        title="Hapus modul beserta progress learner?"
        description={`Modul, bank soal, dan seluruh progress learner pada Modul ${form.moduleNumber || "ini"} akan dihapus permanen. ${isDirty ? "Perubahan yang belum disimpan juga akan dibuang. " : ""}Sertifikat, data farm, dan percakapan pengguna tetap dipertahankan.`}
        confirmLabel="Hapus bersama progress"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={() => {
          setPendingModuleDeleteWithProgress(false);
          remove({ purgeProgress: true });
        }}
      />
    </AdminPageFrame>
  );
}
