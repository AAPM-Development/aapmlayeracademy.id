// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { EditorialContent } from "@/components/academy/EditorialContent";
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
  useSaveAdminQuestion,
  useUpdateAdminModule,
} from "@/lib/useAdminData";
import { hasEditorialVideo, parseEditorialDocument } from "@/lib/editorialDocument";
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

const editorDraftPrefix = "aapm:academy:module-editor:v1";

const EDITOR_SECTIONS = [
  {
    id: "module-section-identity",
    label: "Identitas",
    shortLabel: "Struktur",
    detail: "Nomor, judul, dan ringkasan",
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
    if (!parsed || typeof parsed !== "object" || !parsed.form || typeof parsed.form !== "object") return null;
    return moduleFormFromDraft(parsed.form);
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

function writeEditorDraft(key, form) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), form }));
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = moduleId === "new";
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
    () => `${accountId}:${courseId}:${editorModuleId}`,
    [accountId, courseId, editorModuleId],
  );
  const draftKeyRef = useRef(draftKey);
  const formSnapshot = useMemo(() => JSON.stringify(form), [form]);
  const isDirty = editorReady && formSnapshot !== initialFormRef.current;
  const editorialVideoIsPresent = hasEditorialVideo(form.editorialContent);
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

    const nextForm = isNew ? { ...emptyModule } : moduleFormFromApi(module);
    editorContextRef.current = editorContextKey;
    initialFormRef.current = JSON.stringify(nextForm);
    setForm(nextForm);
    formRef.current = nextForm;
    setEditorReady(true);

    const draft = readEditorDraft(draftKey);
    if (draft && JSON.stringify(draft) !== JSON.stringify(nextForm)) {
      setPendingDraft({ key: draftKey, form: draft });
    } else {
      removeEditorDraft(draftKey);
      setPendingDraft(null);
    }
  }, [accountId, data, draftKey, editorContextKey, isNew]);

  useEffect(() => {
    if (!editorReady || !isDirty || !draftKey) return undefined;
    const timeoutId = window.setTimeout(() => writeEditorDraft(draftKey, form), 250);
    return () => window.clearTimeout(timeoutId);
  }, [draftKey, editorReady, form, isDirty]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      writeEditorDraft(draftKeyRef.current, formRef.current);
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

      writeEditorDraft(draftKeyRef.current, formRef.current);
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
      writeEditorDraft(draftKeyRef.current, formRef.current);
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
  const requestNavigation = (target) => {
    if (!isDirty) {
      releaseHistoryGuard();
      navigate(target);
      return;
    }
    writeEditorDraft(draftKeyRef.current, formRef.current);
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
      initialFormRef.current = JSON.stringify(savedForm);
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
      description="Kelola konten belajar, susunan, video, serta evaluasi dengan aman."
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isDirty && (
            <Badge variant="soft" className="bg-tint-orange text-tint-orange-foreground">
              Belum tersimpan
            </Badge>
          )}
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
        <TabsList className="aapm-scrollbar h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="content" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs shadow-none data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none">Konten modul</TabsTrigger>
          <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs shadow-none data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none">Pratinjau learner</TabsTrigger>
          <TabsTrigger value="assessment" disabled={isNew} className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs shadow-none data-[state=active]:border-brand-orange data-[state=active]:bg-transparent data-[state=active]:shadow-none">
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
              isDirty={isDirty}
              isSaving={isSaving}
              elementItems={editorialInsertActions}
              onAddElement={(type) => editorialComposerRef.current?.addElement(type)}
            />
            <form id="module-editor-form" onSubmit={save} className="space-y-5">
            <section id="module-section-identity" className="scroll-mt-24 border-b border-border">
              <div className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">01 · Struktur</div>
                  <h2 className="mt-1 line-clamp-2 text-base font-semibold">{form.title || "Identitas modul"}</h2>
                  <p className="mt-1 hidden line-clamp-1 text-xs leading-5 text-muted-foreground sm:block">{form.summary || "Tambahkan ringkasan singkat agar learner memahami fokus modul."}</p>
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
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Level</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.levelNumber || "—"}{form.levelName ? ` · ${form.levelName}` : ""}</dd></div>
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Modul</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.moduleNumber || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Roadmap</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.order === "" ? "—" : form.order}</dd></div>
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Kategori</dt><dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{form.category || "—"}</dd></div>
              </dl>
              {identityExpanded && <div id="module-identity-fields" className="border-t border-border bg-surface-subtle/45 py-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Atur posisi modul di roadmap dan informasi yang tampil ke learner.</p>{!identityIsComplete && <span className="text-[10px] text-brand-orange">Lengkapi field wajib sebelum ditutup.</span>}</div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Level</Label>
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
                    <Label>Nama level</Label>
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
            <section id="module-section-content" className="scroll-mt-24">
              <div className="mb-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">02 · Materi utama</div><h2 className="mt-1 text-base font-semibold">Tulis materi dan sisipkan media</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Tulis seperti di Word, lalu sisipkan slide, gambar, tabel, sorotan, tautan, atau video tanpa kehilangan bentuk elemen learner.</p></div>
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
              <div id="module-section-outcomes" className="mt-4 scroll-mt-24 grid gap-4 lg:grid-cols-3">
                {[
                  ["learningObjectives", "Tujuan pembelajaran"],
                  ["keyTakeaways", "Poin penting"],
                  ["checklist", "Checklist praktik"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Textarea
                      rows={5}
                      value={form[key]}
                      onChange={(event) => set(key, event.target.value)}
                      placeholder="Satu item per baris"
                    />
                  </div>
                ))}
              </div>
              <div id="module-section-practice" className="mt-4 scroll-mt-24 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tugas praktik</Label>
                  <Textarea
                    rows={4}
                    value={form.practicalAssignment}
                    onChange={(event) =>
                      set("practicalAssignment", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Naskah video</Label>
                  <Textarea
                    rows={4}
                    value={form.videoScript}
                    onChange={(event) => set("videoScript", event.target.value)}
                  />
                </div>
              </div>
            </section>
            <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs text-muted-foreground"><AapmIcon name={isDirty ? "edit" : "checkRead"} className={`h-4 w-4 ${isDirty ? "text-brand-orange" : "text-brand-green"}`} /> {isDirty ? "Perubahan lokal belum tersimpan." : "Perubahan hanya aktif setelah disimpan."}</div><Button type="submit" disabled={createModule.isPending || updateModule.isPending}>{createModule.isPending || updateModule.isPending ? "Menyimpan…" : "Simpan modul"}<AapmIcon name="checkRead" /></Button></div>
            </form>
          </div>
        </TabsContent>
        <TabsContent value="preview" className="mt-5">
          <Surface className="p-3 sm:p-5 lg:p-7">
            <div className="mx-auto max-w-[1280px]">
              <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Pratinjau learner</div>
                <h2 className="mt-1 text-xl font-semibold">{form.title || "Pratinjau materi"}</h2>
                {form.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{form.summary}</p>}
                </div>
                <p className="max-w-sm text-xs leading-5 text-muted-foreground">Kanvas ini memakai lebar learner sebenarnya; elemen editorial akan tetap mengalir responsif di layar kecil.</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-5 lg:p-7">
                <EditorialContent document={form.editorialContent} fallback={form.content} title={form.title || "Materi modul"} />
                {!editorialVideoIsPresent && form.videoUrl.trim() && (
                  <div className="mt-7 border-t border-border pt-7">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Video fallback modul</p>
                    <LessonMedia module={{ title: form.title || "Video lesson", videoUrl: form.videoUrl }} />
                    {form.videoScript && <p className="mt-3 rounded-xl bg-surface-subtle p-4 text-sm leading-6 text-muted-foreground">{form.videoScript}</p>}
                  </div>
                )}
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
           initialFormRef.current = JSON.stringify(form);
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
