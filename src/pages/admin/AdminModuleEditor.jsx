// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { EditorialContent } from "@/components/academy/EditorialContent";
import { LessonMedia } from "@/components/academy/LessonWorkspace";
import EditorialComposer from "@/components/admin/EditorialComposer";
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
  const isNew = moduleId === "new";
  const { data, isLoading, error, refetch } = useAdminModule(
    isNew ? null : moduleId,
  );
  const createModule = useCreateAdminModule();
  const updateModule = useUpdateAdminModule();
  const deleteModule = useDeleteAdminModule();
  const [form, setForm] = useState(emptyModule);
  const [pendingModuleDelete, setPendingModuleDelete] = useState(false);
  useEffect(() => {
    const module = data?.module;
    if (!module) return;
    setForm({
      levelNumber: module.level || 1,
      levelName: module.levelName || "",
      moduleNumber: module.moduleNumber || "",
      title: module.title || "",
      category: module.category || "",
      summary: module.summary || "",
      content: module.content || "",
      editorialContent: module.editorialContent || null,
      videoUrl: module.videoUrl || "",
      videoScript: module.videoScript || "",
      learningObjectives: listToText(module.learningObjectives),
      keyTakeaways: listToText(module.keyTakeaways),
      checklist: listToText(module.checklist),
      practicalAssignment: module.practicalAssignment || "",
      order: module.order || "",
    });
  }, [data]);
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
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
  const remove = async () => {
    try {
      await deleteModule.mutateAsync(moduleId);
      toast({ title: "Modul dihapus" });
      navigate(`/admin/courses/${courseId}`);
    } catch (deleteError) {
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
      wide
      title={isNew ? "Tambah modul" : `Edit modul ${form.moduleNumber || ""}`}
      description="Kelola konten belajar, susunan, video, serta evaluasi dengan aman."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/admin/courses/${courseId}`}>
              <AapmIcon name="arrowLeft" className="h-4 w-4" /> Kurikulum
            </Link>
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
      <Tabs defaultValue="content">
        <TabsList className="aapm-scrollbar w-full justify-start overflow-x-auto">
          <TabsTrigger value="content">Konten modul</TabsTrigger>
          <TabsTrigger value="preview">Pratinjau learner</TabsTrigger>
          <TabsTrigger value="assessment" disabled={isNew}>
            Bank soal
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-5">
          <form onSubmit={save} className="space-y-5">
            <Surface tone="orange" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3"><AapmIcon name="edit" className="mt-0.5 h-5 w-5 shrink-0 text-tint-orange-foreground" /><div><div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-tint-orange-foreground/75">Content workflow</div><h2 className="mt-1 text-base font-semibold">Bangun modul yang siap dipelajari</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Lengkapi identitas, media, materi, dan outcome. Field yang belum siap dapat disimpan lalu dilanjutkan dari editor ini.</p></div></div>
              <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-[10px] font-semibold text-muted-foreground"><div className="rounded-lg border border-tint-orange-border bg-background/75 px-2 py-2"><div className="text-brand-orange">01</div><div className="mt-1">Struktur</div></div><div className="rounded-lg border border-tint-orange-border bg-background/75 px-2 py-2"><div className="text-brand-orange">02</div><div className="mt-1">Materi</div></div><div className="rounded-lg border border-tint-orange-border bg-background/75 px-2 py-2"><div className="text-brand-orange">03</div><div className="mt-1">Evaluasi</div></div></div>
            </Surface>
            <Surface className="p-5">
              <div className="mb-4 flex items-end justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">01 · Structure</div><h2 className="mt-1 text-base font-semibold">Identitas modul</h2></div><span className="text-[11px] text-muted-foreground">Wajib untuk tampil di roadmap</span></div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label>Nama level</Label>
                  <Input
                    value={form.levelName}
                    onChange={(event) => set("levelName", event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label>Urutan tampil</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(event) => set("order", event.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Judul modul</Label>
                  <Input
                    value={form.title}
                    onChange={(event) => set("title", event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Input
                    value={form.category}
                    onChange={(event) => set("category", event.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Ringkasan</Label>
                <Textarea
                  rows={3}
                  value={form.summary}
                  onChange={(event) => set("summary", event.target.value)}
                />
              </div>
            </Surface>
            <Surface className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">02 · Media</div>
                  <h2 className="text-sm font-semibold">Video materi</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Simpan tautan YouTube, Vimeo, atau file MP4/WebM. Tautan
                    YouTube otomatis memakai embed yang aman.
                  </p>
                </div>
                <AapmIcon name="play" className="h-5 w-5 text-brand-orange" />
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="module-video-url">Tautan video</Label>
                <Input
                  id="module-video-url"
                  type="text"
                  inputMode="url"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="https://youtu.be/... atau /media/lesson-01.mp4"
                  value={form.videoUrl}
                  onChange={(event) => set("videoUrl", event.target.value)}
                  aria-describedby="module-video-help"
                />
                <p
                  id="module-video-help"
                  className="text-[11px] text-muted-foreground"
                >
                  Kosongkan bila modul belum memiliki video. Mendukung URL
                  HTTPS/HTTP dan path media internal; penyimpanan akan
                  memvalidasi tautan sebelum diterbitkan.
                </p>
              </div>
              {/^(https?:\/\/|\/(?!\/))/.test(form.videoUrl.trim()) && (
                <div className="mt-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Pratinjau player
                  </div>
                  <LessonMedia
                    module={{
                      title: form.title || "Video lesson",
                      videoUrl: form.videoUrl,
                    }}
                  />
                </div>
              )}
            </Surface>
            <Surface className="p-5">
              <div className="mb-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">03 · Learning content</div><h2 className="mt-1 text-base font-semibold">Materi editorial dan outcome</h2></div>
              <EditorialComposer
                value={form.editorialContent}
                onChange={(editorialContent) => set("editorialContent", editorialContent)}
              />
              <div className="mt-5 border-t border-border pt-5">
                <Label>Konten Markdown lama (fallback)</Label>
                <Textarea
                  className="mt-2"
                  rows={8}
                  value={form.content}
                  onChange={(event) => set("content", event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Dipakai untuk modul lama atau saat kanvas editorial belum memiliki blok. Markdown tetap aman dan mendukung teks dasar, daftar, tabel, serta tautan.
                </p>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
            </Surface>
            <Surface variant="muted" className="sticky bottom-3 z-20 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs text-muted-foreground"><AapmIcon name="checkRead" className="h-4 w-4 text-brand-green" /> Perubahan hanya aktif setelah disimpan.</div><Button type="submit" disabled={createModule.isPending || updateModule.isPending}>{createModule.isPending || updateModule.isPending ? "Menyimpan…" : "Simpan modul"}<AapmIcon name="checkRead" /></Button></Surface>
          </form>
        </TabsContent>
        <TabsContent value="preview" className="mt-5">
          <Surface className="p-5 sm:p-7">
            <div className="mx-auto max-w-4xl">
              <div className="mb-6 border-b border-border pb-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">Viewport learner</div>
                <h2 className="mt-1 text-xl font-semibold">{form.title || "Pratinjau materi"}</h2>
                {form.summary && <p className="mt-2 text-sm leading-6 text-muted-foreground">{form.summary}</p>}
              </div>
              <EditorialContent document={form.editorialContent} fallback={form.content} title={form.title || "Materi modul"} />
            </div>
          </Surface>
        </TabsContent>
        <TabsContent value="assessment" className="mt-5">
          {!isNew && <QuestionEditor moduleId={Number(moduleId)} />}
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={pendingModuleDelete}
        onOpenChange={setPendingModuleDelete}
        title="Hapus modul?"
        description="Modul dan seluruh bank soalnya akan dihapus. Modul yang sudah memiliki progres learner tetap akan ditolak oleh sistem."
        confirmLabel="Hapus modul"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={() => {
          setPendingModuleDelete(false);
          remove();
        }}
      />
    </AdminPageFrame>
  );
}
