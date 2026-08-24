import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiAvatar from "@/components/ai/AiAvatar";
import AiStreamActivity from "@/components/ai/AiStreamActivity";
import { Button, ScrollArea, Switch } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { useFarmData, useUserProgress } from "@/lib/useCourseData";
import { useAiChat } from "@/components/ai/AiChatProvider";

const MermaidDiagram = React.lazy(
  () => import("@/components/ai/MermaidDiagram"),
);

const welcomeMessage =
  "Bawa situasi yang Anda lihat di farm. Saya bantu mengurai sinyal, menyusun urutan pemeriksaan, lalu merumuskan langkah berikutnya.";

const workspaceTools = [
  { to: "/kpi", label: "Farm KPI", icon: "solar:chart-square-bold-duotone" },
  {
    to: "/calculators",
    label: "Kalkulator",
    icon: "solar:calculator-bold-duotone",
  },
  { to: "/modules", label: "Materi", icon: "solar:notebook-bold-duotone" },
];

function filterConversations(conversations, query) {
  const keyword = query.trim().toLocaleLowerCase("id-ID");
  if (!keyword) return conversations;
  return conversations.filter((conversation) =>
    `${conversation.title || ""} ${conversation.lastMessagePreview || ""}`
      .toLocaleLowerCase("id-ID")
      .includes(keyword),
  );
}

function personalizedSuggestions({ farm, progress, user }) {
  const name = (
    user?.fullName ||
    user?.full_name ||
    user?.email ||
    "saya"
  ).split(" ")[0];
  const latest = farm.at(-1);
  const previous = farm.at(-2);
  const completed = progress.filter((item) => item.completed).length;

  if (!latest)
    return [
      `${name}, saya belum punya data KPI farm. Bantu saya menentukan lima data baseline yang perlu dicatat minggu ini.`,
      "Buatkan format catatan harian sederhana untuk HDP, pakan, air, mortalitas, dan berat telur.",
      completed
        ? `Saya sudah menyelesaikan ${completed} modul. Topik operasional apa yang paling tepat saya lanjutkan?`
        : "Saya baru mulai belajar. Urutkan fokus pertama yang paling penting untuk memahami performa layer farm.",
      "Buatkan checklist biosecurity harian yang praktis untuk closed house layer.",
    ];

  const hdp = Number(latest.henDayProduction);
  const previousHdp = Number(previous?.henDayProduction);
  const hdpPrompt = Number.isFinite(hdp)
    ? `HDP minggu ${latest.week} tercatat ${hdp}%${Number.isFinite(previousHdp) ? `, dari ${previousHdp}% minggu sebelumnya` : ""}. Bantu saya menentukan pemeriksaan prioritas.`
    : `Bantu saya membaca data operasional minggu ${latest.week} dan menentukan sinyal yang perlu diperiksa lebih dulu.`;
  const waterPrompt = Number.isFinite(Number(latest.waterIntake))
    ? `Konsumsi air minggu ${latest.week} adalah ${latest.waterIntake}. Faktor apa yang perlu saya bandingkan sebelum menyimpulkan penyebabnya?`
    : "Data air belum lengkap. Buatkan cara mencatat konsumsi air yang dapat dibandingkan dengan suhu dan feed intake.";
  const fcrPrompt = Number.isFinite(Number(latest.fcr))
    ? `FCR terakhir saya ${latest.fcr}. Jelaskan data pendamping apa yang perlu dibaca agar evaluasinya tidak keliru.`
    : "Buatkan urutan analisis hubungan feed intake, egg mass, dan FCR untuk data farm saya.";
  return [
    hdpPrompt,
    waterPrompt,
    fcrPrompt,
    completed
      ? `Dengan ${completed} modul selesai, materi mana yang relevan untuk mendukung evaluasi KPI saya saat ini?`
      : "Hubungkan evaluasi KPI awal saya dengan jalur belajar Academy yang paling relevan.",
  ];
}

function MarkdownAnswer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h2 className="mt-5 text-base font-semibold tracking-[-0.02em] first:mt-0">
            {children}
          </h2>
        ),
        h2: ({ children }) => (
          <h3 className="mt-5 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        h3: ({ children }) => (
          <h4 className="mt-4 text-sm font-semibold first:mt-0">{children}</h4>
        ),
        p: ({ children }) => <p className="mt-3 first:mt-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-brand-orange">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-brand-orange">
            {children}
          </ol>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mt-4 border-l-2 border-brand-orange pl-3 text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="aapm-ai-table-wrap">
            <table>{children}</table>
          </div>
        ),
        th: ({ children }) => <th>{children}</th>,
        td: ({ children }) => <td>{children}</td>,
        code: ({ className, children, ...props }) => {
          const language = /language-(\w+)/.exec(className || "")?.[1];
          const source = String(children).replace(/\n$/, "");
          if (language === "mermaid")
            return (
              <React.Suspense
                fallback={
                  <div className="aapm-ai-mermaid-loading">
                    Menyiapkan diagram…
                  </div>
                }
              >
                <MermaidDiagram chart={source} />
              </React.Suspense>
            );
          if (language)
            return (
              <pre className="aapm-ai-code-block">
                <code className={className} {...props}>
                  {source}
                </code>
              </pre>
            );
          return (
            <code className="aapm-ai-inline-code" {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function AssistantMessage({ message, retryPrompt, onRetry, streamSteps }) {
  const [collapsed, setCollapsed] = useState(false);
  const canCollapse = !message.streaming && message.content.length > 1150;
  return (
    <article className="min-w-0 max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <AapmIcon
          name="solar:stars-minimalistic-bold-duotone"
          className="h-4 w-4 text-brand-orange"
        />
        <span className="text-sm font-semibold tracking-[-0.015em]">APPI</span>
        {message.streaming && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-brand-orange">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" />{" "}
            Menjawab
          </span>
        )}
      </div>
      {message.streaming && (
        <AiStreamActivity label={message.streamStatus} steps={streamSteps} />
      )}
      {message.content && (
        <>
          <div
            className={`aapm-ai-response ${message.streaming ? "aapm-ai-response--streaming" : ""} relative mt-2.5 text-sm leading-6 text-foreground ${canCollapse && collapsed ? "max-h-56 overflow-hidden" : ""}`}
          >
            <MarkdownAnswer content={message.content} />
            {canCollapse && collapsed && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
            )}
          </div>
          {canCollapse && (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="mt-3 text-xs font-semibold text-brand-orange transition-colors hover:text-brand-orange/75"
            >
              {collapsed ? "Tampilkan jawaban lengkap" : "Ringkas jawaban"}
            </button>
          )}
        </>
      )}
      {message.fallback && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-tint-orange-border bg-tint-orange px-2.5 py-2 text-[11px] leading-4 text-tint-orange-foreground">
          <AapmIcon
            name="solar:info-circle-bold"
            className="h-3.5 w-3.5 shrink-0"
          />
          <span>
            {message.notice ||
              "Provider belum tersedia pada permintaan ini; respons lokal tetap tersimpan."}
          </span>
          {retryPrompt && (
            <button
              type="button"
              onClick={() => onRetry(retryPrompt)}
              className="font-semibold text-brand-orange underline underline-offset-2"
            >
              Coba provider lagi
            </button>
          )}
        </div>
      )}
      {message.error && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/20 bg-danger/10 px-2.5 py-2 text-[11px] leading-4 text-danger">
          <AapmIcon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Permintaan tidak dapat diproses. Coba kirim ulang beberapa saat lagi.
        </div>
      )}
      {!message.streaming && message.provider && (
        <div className="mt-3 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <AapmIcon
            name={
              message.fallback
                ? "solar:info-circle-bold"
                : "solar:verified-check-bold"
            }
            className={`h-3.5 w-3.5 shrink-0 ${message.fallback ? "text-brand-orange" : "text-brand-green"}`}
          />
          <span className="truncate">
            {message.fallback
              ? "Respons lokal tersimpan"
              : `${message.provider === "openrouter" ? "OpenRouter" : message.provider} · ${message.model}`}
          </span>
        </div>
      )}
    </article>
  );
}

function ConversationList({
  conversations,
  activeConversationId,
  loading,
  disabled,
  onSelect,
  onDelete,
  onNew,
}) {
  const [query, setQuery] = useState("");
  const visibleConversations = filterConversations(conversations, query);

  return (
    <aside className="hidden w-72 shrink-0 border-r border-border bg-surface-subtle/35 lg:flex lg:flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <p className="text-xs font-semibold">Percakapan</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Tersimpan di akun Anda
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onNew}
          disabled={disabled}
          className="h-8 w-8"
          aria-label="Percakapan baru"
        >
          <AapmIcon
            name="solar:pen-new-square-bold"
            className="h-4 w-4 text-brand-orange"
          />
        </Button>
      </div>
      <label className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 focus-within:border-brand-orange/45">
        <AapmIcon
          name="solar:magnifer-bold-duotone"
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari riwayat"
          className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
          aria-label="Cari riwayat percakapan"
        />
      </label>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        <div className="space-y-1">
          {loading && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Memuat percakapan…
            </p>
          )}
          {!loading && conversations.length === 0 && (
            <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
              Belum ada riwayat. Percakapan pertama akan tersimpan otomatis.
            </p>
          )}
          {!loading && conversations.length > 0 && visibleConversations.length === 0 && (
            <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">
              Tidak ada percakapan yang cocok.
            </p>
          )}
          {visibleConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group flex items-center gap-1 rounded-lg ${conversation.id === activeConversationId ? "bg-tint-orange" : "hover:bg-surface-default"}`}
            >
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                disabled={disabled}
                className="min-w-0 flex-1 px-2.5 py-2.5 text-left"
              >
                <span className="block truncate text-xs font-medium text-foreground">
                  {conversation.title}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {conversation.lastMessagePreview || "Belum ada pesan"}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (
                    window.confirm(
                      `Hapus percakapan \"${conversation.title}\"? Riwayat ini tidak dapat dipulihkan.`,
                    )
                  ) {
                    onDelete(conversation.id);
                  }
                }}
                disabled={disabled}
                className="mr-1 h-7 w-7 shrink-0 border border-border bg-background text-muted-foreground transition-colors hover:border-danger/30 hover:text-danger"
                aria-label={`Hapus percakapan ${conversation.title}`}
              >
                <AapmIcon
                  name="solar:trash-bin-trash-bold"
                  className="h-3.5 w-3.5 text-muted-foreground hover:text-danger"
                />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t border-border p-3">
        <p className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
          ALAT CEPAT
        </p>
        <div className="space-y-1">
          {workspaceTools.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-default hover:text-foreground"
            >
              <AapmIcon
                name={tool.icon}
                className="h-4 w-4 text-brand-orange"
              />
              <span>{tool.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}

function MobileConversationSheet({
  open,
  conversations,
  activeConversationId,
  loading,
  disabled,
  onClose,
  onSelect,
  onDelete,
  onNew,
}) {
  const [query, setQuery] = useState("");
  const visibleConversations = filterConversations(conversations, query);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Tutup riwayat percakapan"
        onClick={onClose}
        className="fixed inset-0 z-[84] bg-foreground/25 backdrop-blur-[1px] lg:hidden"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Riwayat percakapan APPI"
        className="fixed inset-x-0 bottom-0 z-[85] flex h-[min(84dvh,44rem)] min-h-[28rem] flex-col overflow-hidden rounded-t-[1.5rem] border-x border-t border-border bg-background shadow-[0_-18px_52px_hsl(var(--foreground)/0.2)] lg:hidden"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">Percakapan</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Tersimpan khusus di akun Anda
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNew}
              disabled={disabled}
              className="h-8 gap-1.5 px-2.5 text-xs"
            >
              <AapmIcon
                name="solar:pen-new-square-bold"
                className="h-3.5 w-3.5 text-brand-orange"
              />
              Baru
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              aria-label="Tutup riwayat"
            >
              <AapmIcon name="solar:close-circle-bold" className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <label className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-subtle px-3 py-2.5 focus-within:border-brand-orange/45">
          <AapmIcon
            name="solar:magnifer-bold-duotone"
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari riwayat"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            aria-label="Cari riwayat percakapan"
          />
        </label>
        <ScrollArea className="min-h-0 flex-1 px-3 py-3">
          <div className="space-y-1.5">
            {loading && (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                Memuat percakapan…
              </p>
            )}
            {!loading && conversations.length === 0 && (
              <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">
                Belum ada riwayat. Pertanyaan pertama akan membuat percakapan
                baru secara otomatis.
              </p>
            )}
            {!loading && conversations.length > 0 && visibleConversations.length === 0 && (
              <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">
                Tidak ada percakapan yang cocok.
              </p>
            )}
            {visibleConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`flex items-center gap-1.5 rounded-xl border p-1.5 transition-colors ${conversation.id === activeConversationId ? "border-brand-orange/35 bg-tint-orange" : "border-transparent hover:border-border hover:bg-surface-default"}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  disabled={disabled}
                  className="min-w-0 flex-1 px-2.5 py-2.5 text-left"
                >
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {conversation.title}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                    {conversation.lastMessagePreview || "Belum ada pesan"}
                  </span>
                </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (
                    window.confirm(
                      `Hapus percakapan \"${conversation.title}\"? Riwayat ini tidak dapat dipulihkan.`,
                    )
                  ) {
                    onDelete(conversation.id);
                  }
                }}
                disabled={disabled}
                className="mr-0.5 h-8 w-8 shrink-0 border border-border bg-background text-muted-foreground hover:border-danger/30 hover:text-danger"
                  aria-label={`Hapus percakapan ${conversation.title}`}
                >
                  <AapmIcon
                    name="solar:trash-bin-trash-bold"
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}

export default function AiAssistant() {
  const [input, setInput] = useState("");
  const [includeFarm, setIncludeFarm] = useState(true);
  const [allowWebSearch, setAllowWebSearch] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const scrollRef = useRef(null);
  const imageInputRef = useRef(null);
  const { data: farm = [] } = useFarmData();
  const { data: progress = [] } = useUserProgress();
  const { user } = useAuth();
  const {
    conversations,
    conversationsLoading,
    activeConversationId,
    messages,
    isDraft,
    isLoadingConversation,
    isStreaming,
    streamStatus,
    streamSteps,
    selectConversation,
    startNewConversation,
    deleteConversation,
    send,
  } = useAiChat();
  const suggestions = useMemo(
    () => personalizedSuggestions({ farm, progress, user }),
    [farm, progress, user],
  );
  const contextLabel = includeFarm
    ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI aktif`
    : "Tanpa konteks KPI";
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role !== "user");
  const shellAvatarState = isStreaming
    ? lastAssistantMessage?.content
      ? "responding"
      : "thinking"
    : lastAssistantMessage?.error
      ? "alert"
      : lastAssistantMessage?.provider
        ? "complete"
        : "idle";

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);
  useEffect(() => {
    if (!isDraft && !activeConversationId && conversations.length > 0)
      selectConversation(conversations[0].id);
  }, [activeConversationId, conversations, isDraft, selectConversation]);

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setAttachmentError("Gunakan foto JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAttachmentError("Ukuran foto maksimal 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageAttachment({ dataUrl: String(reader.result), name: file.name });
      setAttachmentError("");
    };
    reader.onerror = () => setAttachmentError("Foto tidak dapat dibaca.");
    reader.readAsDataURL(file);
  };

  const submit = async (text = input) => {
    const content = text.trim();
    if ((!content && !imageAttachment) || isStreaming) return;
    const image = imageAttachment;
    const message =
      content ||
      "Tolong analisis foto farm ini. Bedakan observasi visual, hal yang belum pasti, dan data yang perlu saya cek berikutnya.";
    setInput("");
    setImageAttachment(null);
    setAttachmentError("");
    await send(message, { includeFarm, allowWebSearch, image });
  };

  return (
    <div className="flex h-[calc(100dvh-8.6rem-env(safe-area-inset-bottom))] min-h-[31rem] overflow-hidden bg-background lg:h-[calc(100dvh-73px)] lg:min-h-[33rem]">
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        loading={conversationsLoading}
        disabled={isStreaming}
        onSelect={selectConversation}
        onDelete={deleteConversation}
        onNew={startNewConversation}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tint-orange text-brand-orange">
              <AapmIcon
                name="solar:cpu-bolt-bold-duotone"
                className="h-4 w-4"
              />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-[-0.015em]">
                APPI
              </h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                AAPM Predictive & Personal Intelligence · riwayat tersimpan di
                akun Anda.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              disabled={isStreaming}
              className="h-8 gap-1.5 px-2.5 text-xs lg:hidden"
            >
              <AapmIcon
                name="solar:history-2-bold-duotone"
                className="h-3.5 w-3.5"
              />
              Riwayat
            </Button>
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${includeFarm ? "bg-tint-green text-tint-green-foreground" : "bg-surface-subtle text-muted-foreground"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${includeFarm ? "bg-brand-green" : "bg-muted-foreground/50"}`}
              />
              {contextLabel}
            </span>
            {allowWebSearch && (
              <span className="hidden items-center gap-1.5 rounded-full bg-tint-orange px-2.5 py-1 text-[10px] font-medium text-tint-orange-foreground sm:inline-flex">
                <AapmIcon
                  name="solar:global-bold-duotone"
                  className="h-3 w-3"
                />
                Referensi web
              </span>
            )}
            <span className="hidden items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-[10px] font-medium text-muted-foreground xl:inline-flex">
              <AapmIcon
                name="solar:history-2-bold-duotone"
                className="h-3 w-3 text-brand-green"
              />
              Memori 3 bulan
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              disabled={isStreaming}
              className="h-8 px-2.5 text-xs"
            >
              <AapmIcon
                name="solar:pen-new-square-bold"
                className="h-3.5 w-3.5"
              />{" "}
              Baru
            </Button>
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex w-full max-w-3xl flex-col px-5 py-6 sm:px-8 sm:py-9">
              {isLoadingConversation ? (
                <p className="text-sm text-muted-foreground">
                  Memuat percakapan…
                </p>
              ) : messages.length === 0 ? (
                <div className="py-3 sm:py-8">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em]">
                      Mari mulai dari situasi di farm.
                    </h2>
                    <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
                      {welcomeMessage}
                    </p>
                  </div>
                  <div className="mt-8 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => submit(suggestion)}
                        className="group rounded-xl border border-border bg-surface-default px-3 py-3 text-left text-xs leading-5 text-muted-foreground transition-colors hover:border-brand-orange/35 hover:bg-tint-orange hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex gap-2">
                          <AapmIcon
                            name="solar:arrow-right-up-bold"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          />
                          {suggestion}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-7 sm:gap-9">
                  {messages.map((message, index) =>
                    message.role === "user" ? (
                      <div key={message.id} className="flex justify-end">
                        <div className="max-w-[84%] rounded-2xl rounded-br-md bg-brand-green px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm sm:max-w-[88%]">
                          {message.image?.dataUrl && (
                            <img
                              src={message.image.dataUrl}
                              alt="Foto yang dikirim untuk dianalisis"
                              className="mb-2.5 max-h-56 w-full rounded-xl object-cover"
                            />
                          )}
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <AssistantMessage
                        key={message.id}
                        message={{ ...message, streamStatus }}
                        streamSteps={streamSteps}
                        retryPrompt={
                          message.fallback ? messages[index - 1]?.content : ""
                        }
                        onRetry={submit}
                      />
                    ),
                  )}
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          <div key={activeConversationId || "draft"} className="aapm-ai-presence-rail relative z-10 flex h-14 shrink-0 items-end border-t border-border/50 px-5 pb-1.5 sm:h-16 sm:px-8 sm:pb-2" data-state={shellAvatarState} aria-label="Status APPI">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/0" aria-hidden="true" />
            <div className="relative z-10 mx-auto flex w-full max-w-3xl">
              <AiAvatar size="md" state={shellAvatarState} decorative className="shrink-0" />
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:py-4">
          <div className="mx-auto max-w-3xl">
            <div className="min-w-0">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageSelection}
                className="sr-only"
              />
              {imageAttachment && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-surface-subtle px-2.5 py-2">
                  <img
                    src={imageAttachment.dataUrl}
                    alt="Pratinjau foto lampiran"
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                    {imageAttachment.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setImageAttachment(null)}
                    className="h-7 w-7 shrink-0"
                    aria-label="Hapus foto"
                  >
                    <AapmIcon
                      name="solar:close-circle-bold"
                      className="h-3.5 w-3.5"
                    />
                  </Button>
                </div>
              )}
              <div className="aapm-field flex items-end gap-2 rounded-2xl border border-input bg-surface-elevated p-2 shadow-sm transition-shadow focus-within:shadow-md">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isStreaming}
                  className="mb-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-brand-orange"
                  aria-label="Lampirkan foto farm"
                >
                  <AapmIcon
                    name="solar:gallery-add-bold-duotone"
                    className="h-4 w-4"
                  />
                </Button>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder="Tanyakan situasi yang sedang terjadi di farm…"
                  className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => submit()}
                  disabled={isStreaming || (!input.trim() && !imageAttachment)}
                  className="h-9 w-9 shrink-0 rounded-xl text-brand-orange hover:bg-tint-orange hover:text-brand-orange"
                >
                  <AapmIcon
                    name="solar:plain-2-bold"
                    className="h-[18px] w-[18px]"
                  />
                  <span className="sr-only">Kirim pertanyaan</span>
                </Button>
              </div>
              {attachmentError && (
                <p className="mt-1.5 text-[10px] font-medium text-danger">
                  {attachmentError}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
                  <AapmIcon
                    name="solar:medical-kit-bold"
                    className="h-3.5 w-3.5 shrink-0 text-brand-orange"
                  />{" "}
                  Untuk diagnosis penyakit dan dosis obat, konsultasikan dengan
                  dokter hewan.
                </p>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <Switch
                    checked={includeFarm}
                    onCheckedChange={setIncludeFarm}
                    aria-label="Sertakan data KPI sebagai konteks"
                    disabled={isStreaming}
                    className="scale-75"
                  />
                  Pakai KPI
                </label>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <Switch
                    checked={allowWebSearch}
                    onCheckedChange={setAllowWebSearch}
                    aria-label="Izinkan APPI mencari referensi web"
                    disabled={isStreaming}
                    className="scale-75"
                  />
                  <AapmIcon
                    name="solar:global-bold-duotone"
                    className="h-3.5 w-3.5 text-brand-orange"
                  />
                  Cari web
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>
      <MobileConversationSheet
        open={historyOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        loading={conversationsLoading}
        disabled={isStreaming}
        onClose={() => setHistoryOpen(false)}
        onSelect={(id) => {
          selectConversation(id);
          setHistoryOpen(false);
        }}
        onDelete={deleteConversation}
        onNew={() => {
          startNewConversation();
          setHistoryOpen(false);
        }}
      />
      <aside className="hidden w-72 shrink-0 border-l border-border bg-surface-subtle/45 2xl:flex 2xl:flex-col">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold">Konteks farm</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Gunakan hingga delapan catatan KPI terakhir.
              </p>
            </div>
            <Switch
              checked={includeFarm}
              onCheckedChange={setIncludeFarm}
              aria-label="Sertakan data KPI Dashboard sebagai konteks"
            />
          </div>
          <div
            className={`mt-4 rounded-lg px-3 py-2.5 text-[11px] leading-5 ${includeFarm ? "bg-tint-green text-tint-green-foreground" : "bg-surface-default text-muted-foreground"}`}
          >
            <span className="block font-semibold">
              {includeFarm ? "Konteks aktif" : "Konteks nonaktif"}
            </span>
            <span className="opacity-80">
              {includeFarm
                ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI akan dibaca.`
                : "Jawaban tidak memakai data Dashboard."}
            </span>
          </div>
        </div>
        <div className="mt-auto border-t border-border p-5">
          <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            CAKUPAN ANALISIS
          </div>
          <ul className="mt-3 space-y-3 text-[11px] leading-5 text-muted-foreground">
            <li className="flex gap-2">
              <AapmIcon
                name="solar:chart-square-bold-duotone"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange"
              />
              Sinyal HDP, FCR, pakan, air, dan berat telur.
            </li>
            <li className="flex gap-2">
              <AapmIcon
                name="solar:clipboard-check-bold-duotone"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange"
              />
              Urutan tindakan dan checklist lapangan.
            </li>
            <li className="flex gap-2">
              <AapmIcon
                name="solar:shield-check-bold"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-green"
              />
              Bukan pengganti diagnosis medis veteriner.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
