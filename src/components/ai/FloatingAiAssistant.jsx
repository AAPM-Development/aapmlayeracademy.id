import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiProfileAvatar from "@/components/ai/AiProfileAvatar";
import AiCompanionDock from "@/components/ai/AiCompanionDock";
import useChatScrollFollow from "@/components/ai/useChatScrollFollow";
import AiActivityList from "@/components/ai/AiActivityList";
import {
  AiConversationRow,
  AiHistoryToolbar,
  filterAndSortConversations,
} from "@/components/ai/AiHistoryControls";
import AiComposer from "@/components/ai/AiComposer";
import AiQuickActions from "@/components/ai/AiQuickActions";
import { Button, ConfirmDialog } from "@/components/primitives";
import { useAiChat } from "@/components/ai/AiChatProvider";

const MermaidDiagram = React.lazy(
  () => import("@/components/ai/MermaidDiagram"),
);

const quickActions = [
  {
    kind: "prompt",
    label: "Tinjau KPI terbaru",
    detail: "Baca sinyal yang perlu dicek",
    icon: "solar:chart-square-bold-duotone",
    prompt:
      "Bantu saya meninjau catatan KPI terakhir dan tentukan tiga pemeriksaan prioritas di farm.",
  },
  {
    kind: "route",
    to: "/kpi",
    label: "Buka KPI farm",
    detail: "Lihat data sebelum bertanya",
    icon: "solar:chart-2-bold-duotone",
  },
  {
    kind: "route",
    to: "/calculators",
    label: "Pakai kalkulator",
    detail: "Hitung indikator operasional",
    icon: "solar:calculator-bold-duotone",
  },
];

function pageContextForPath(pathname) {
  if (pathname === "/calculators") return "calculators";
  if (pathname === "/kpi") return "kpi";
  if (pathname === "/modules" || pathname.startsWith("/module/")) {
    return "learning";
  }
  if (pathname === "/certification") return "certification";
  if (pathname === "/exam") return "exam";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/dashboard" || pathname === "/") return "dashboard";
  return "";
}

function pageContextLabel(pathname) {
  const labels = {
    calculators: "Kalkulator farm",
    kpi: "KPI farm",
    learning: "Materi belajar",
    certification: "Sertifikasi",
     exam: "Ujian akhir",
    admin: "Administrasi Academy",
    dashboard: "Dashboard Academy",
  };
  return labels[pageContextForPath(pathname)] || "Academy";
}

function BubbleAnswer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
        h1: ({ children }) => (
          <h3 className="mt-4 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        h2: ({ children }) => (
          <h3 className="mt-4 text-sm font-semibold first:mt-0">{children}</h3>
        ),
        h3: ({ children }) => (
          <h4 className="mt-3 text-xs font-semibold first:mt-0">{children}</h4>
        ),
        ul: ({ children }) => (
          <ul className="mt-2 list-disc space-y-1 pl-4 marker:text-brand-orange">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-2 list-decimal space-y-1 pl-4 marker:text-brand-orange">
            {children}
          </ol>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
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

export default function FloatingAiAssistant() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [input, setInput] = useState("");
  const [allowWebSearch, setAllowWebSearch] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyView, setHistoryView] = useState("chats");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySort, setHistorySort] = useState("updated");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const closeTimer = useRef(null);
  const imageInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeConversationId,
    conversations,
    activity,
    activityLoading,
    messages,
    isStreaming,
    streamStatus,
    streamSteps,
    streamPhase,
    startNewConversation,
    selectConversation,
    deleteConversation,
    send,
  } = useAiChat();
  const activeConversation = conversations.find(
    (item) => item.id === activeConversationId,
  );
  const {
    viewportRef: chatViewportRef,
    endRef: chatEndRef,
    showJumpToLatest,
    jumpToLatest,
  } = useChatScrollFollow({
    content: messages,
    activeKey: activeConversationId,
    isStreaming,
  });

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setClosing(true);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  useEffect(() => {
    if (!closing) return undefined;
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 180);
    return () => window.clearTimeout(closeTimer.current);
  }, [closing]);

  if (location.pathname === "/ai-assistant") return null;

  const visibleConversations = filterAndSortConversations(
    conversations,
    historyQuery,
    historySort,
  );
  const openPanel = () => {
    setClosing(false);
    setOpen(true);
  };
  const closePanel = () => {
    setHistoryOpen(false);
    setClosing(true);
  };
  const submit = async (text = input) => {
    const message =
      text.trim() ||
      (imageAttachment
        ? "Tolong analisis foto farm ini dan sebutkan observasi yang perlu saya verifikasi di lapangan."
        : "");
    if (!message || isStreaming) return;
    const image = imageAttachment;
    setInput("");
    setImageAttachment(null);
    setAttachmentError("");
    await send(message, {
      includeFarm: true,
      allowWebSearch,
      pageContext: pageContextForPath(location.pathname),
      image,
    });
  };
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
    reader.readAsDataURL(file);
  };
  const handleAction = (action) => {
    if (action.kind === "prompt") return submit(action.prompt);
    closePanel();
    navigate(action.to);
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Tutup APPI"
          onClick={closePanel}
          className="fixed inset-0 z-[79] bg-foreground/20 backdrop-blur-[1px] sm:hidden"
        />
      )}
      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="APPI cepat"
          className={`aapm-ai-panel fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-[80] flex h-[min(72dvh,44rem)] min-h-0 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_60px_hsl(var(--foreground)/0.18)] sm:inset-x-4 sm:max-w-[calc(100vw-2rem)] lg:bottom-5 lg:left-auto lg:right-5 lg:h-[min(39rem,calc(100dvh-6.5rem))] lg:w-[25rem] ${closing ? "aapm-ai-panel--exit" : "aapm-ai-panel--enter"}`}
        >
          <header className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <AiProfileAvatar
                size="sm"
                state={isStreaming ? streamPhase : "idle"}
              />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">APPI</h2>
                <p className="truncate text-[10px] text-muted-foreground">
                  {activeConversation?.title ||
                    "Siap membantu dari halaman ini"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setHistoryOpen(true)}
                disabled={isStreaming}
                className="h-8 w-8"
                aria-label="Buka riwayat percakapan"
              >
                <AapmIcon
                  name="solar:chat-round-dots-bold-duotone"
                  className="h-3.5 w-3.5"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setHistoryOpen(false);
                  startNewConversation();
                }}
                disabled={isStreaming}
                className="h-8 w-8"
                aria-label="Percakapan baru"
              >
                <AapmIcon
                  name="solar:pen-new-square-bold"
                  className="h-3.5 w-3.5"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closePanel}
                className="h-8 w-8"
                aria-label="Tutup AI Assistant"
              >
                <AapmIcon name="solar:close-circle-bold" className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
            <div
              ref={chatViewportRef}
              className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-24 pt-4"
            >
              <div className="flex min-h-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
              {messages.length === 0 ? (
                <div className="my-auto pb-2">
                  <p className="text-sm font-semibold tracking-[-0.015em]">
                    Tanya, lalu lanjutkan di mana saja.
                  </p>
                  <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                    KPI aktif dapat ikut dibaca. Percakapan ini tersimpan khusus
                    di akun Anda.
                  </p>
                  <div className="mt-5 divide-y divide-border rounded-xl border border-border">
                    <p className="px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
                      AKSI CEPAT
                    </p>
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleAction(action)}
                        className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-tint-orange/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange">
                          <AapmIcon name={action.icon} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-foreground">
                            {action.label}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {action.detail}
                          </span>
                        </span>
                        <AapmIcon
                          name="solar:arrow-right-up-bold"
                          className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) =>
                  message.role === "user" ? (
                    <div
                  key={message.id}
                  className="ml-auto min-w-0 max-w-[86%] break-words rounded-2xl rounded-br-md bg-brand-green px-3 py-2 text-xs leading-5 text-white [overflow-wrap:anywhere]"
                >
                      {message.image?.dataUrl && (
                        <img
                          src={message.image.dataUrl}
                          alt="Foto yang dikirim untuk dianalisis"
                          className="mb-2 max-h-40 w-full rounded-xl object-cover"
                        />
                      )}
                      {message.content}
                    </div>
                  ) : (
                    <article
                      key={message.id}
                      className="min-w-0 max-w-full break-words text-xs leading-5"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                        <AapmIcon
                          name="ai"
                          className="h-3.5 w-3.5 text-brand-orange"
                        />{" "}
                        APPI
                        {message.streaming && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium text-brand-orange">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" />{" "}
                            Live
                          </span>
                        )}
                      </div>
                      {message.content && (
                        <div
                          className={`aapm-ai-response ${message.streaming ? "aapm-ai-response--streaming" : ""} mt-2.5`}
                        >
                          <BubbleAnswer content={message.content} />
                        </div>
                      )}
                      {message.fallback && (
                        <p className="mt-2 text-[10px] text-brand-orange">
                          {message.notice ||
                            "Respons lokal tersimpan; provider dapat dicoba kembali di workspace penuh."}
                        </p>
                      )}
                      {message.error && (
                        <p className="mt-2 text-[10px] text-danger">
                          Permintaan belum dapat diproses.
                        </p>
                      )}
                      {!message.streaming && message.provider && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {message.fallback
                            ? "Respons lokal tersimpan"
                            : `${message.provider === "openrouter" ? "OpenRouter" : message.provider} · ${message.model}`}
                        </p>
                      )}
                      {!message.streaming && !message.error && (
                        <AiQuickActions
                          content={message.content}
                          pathname={location.pathname}
                          onSelect={submit}
                          disabled={isStreaming}
                          compact
                        />
                      )}
                    </article>
                  ),
                )
              )}
              <div ref={chatEndRef} />
              </div>
            </div>
            {showJumpToLatest && (
              <button
                type="button"
                onClick={jumpToLatest}
                className="absolute bottom-[5.7rem] left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/95 px-2.5 py-1.5 text-[10px] font-semibold text-foreground shadow-[0_8px_24px_hsl(var(--foreground)/0.14)] backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
              >
                <AapmIcon name="chevronDown" className="h-3 w-3 text-brand-orange" />
                Ke terbaru
              </button>
            )}
            <AiCompanionDock
              compact
              streaming={isStreaming}
              state={streamPhase}
              label={streamStatus}
              steps={streamSteps}
            />
            {historyOpen && (
              <aside
                aria-label="Riwayat percakapan APPI"
                className="aapm-ai-history-sheet absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-background"
              >
                <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Riwayat chat</h3>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Tersimpan khusus di akun Anda
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setHistoryOpen(false)}
                    className="h-8 w-8"
                    aria-label="Tutup riwayat"
                  >
                    <AapmIcon
                      name="solar:close-circle-bold"
                      className="h-4 w-4"
                    />
                  </Button>
                </div>
                <div className="min-w-0 max-w-full px-3 pb-1 pt-3">
                  <AiHistoryToolbar
                    view={historyView}
                    onViewChange={setHistoryView}
                    query={historyQuery}
                    onQueryChange={setHistoryQuery}
                    sort={historySort}
                    onSortChange={setHistorySort}
                    onClearQuery={() => setHistoryQuery("")}
                    conversationCount={conversations.length}
                    activityCount={activity.length}
                    compact
                  />
                </div>
                <div className="aapm-ai-history-scroll min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3">
                  {historyView === "activity" ? (
                    <div className="min-w-0 max-w-full pt-3">
                      <AiActivityList activity={activity} loading={activityLoading} />
                    </div>
                  ) : <div className="min-w-0 max-w-full space-y-1.5 pt-3">
                    {visibleConversations.length === 0 && (
                      <p className="px-2 py-5 text-xs leading-5 text-muted-foreground">
                        {historyQuery
                          ? "Tidak ada percakapan yang cocok."
                          : "Belum ada riwayat percakapan."}
                      </p>
                    )}
                    {visibleConversations.map((conversation) => (
                      <AiConversationRow
                        key={conversation.id}
                        conversation={conversation}
                        active={conversation.id === activeConversationId}
                        disabled={isStreaming}
                        onSelect={(conversationId) => {
                          selectConversation(conversationId);
                          setHistoryOpen(false);
                        }}
                        onDelete={setPendingDelete}
                      />
                    ))}
                  </div>}
                </div>
              </aside>
            )}
          </div>
          <footer className="shrink-0 border-t border-border bg-background p-3">
            <AiComposer
              input={input}
              setInput={setInput}
              onSubmit={() => submit()}
              isStreaming={isStreaming}
              imageInputRef={imageInputRef}
              onImageSelection={handleImageSelection}
              imageAttachment={imageAttachment}
              onRemoveImage={() => setImageAttachment(null)}
              attachmentError={attachmentError}
              allowWebSearch={allowWebSearch}
              onAllowWebSearchChange={setAllowWebSearch}
              contextLabel={pageContextLabel(location.pathname)}
              placeholder="Tanyakan situasi di halaman ini…"
              compact
              showFarmToggle={false}
              idPrefix="appi-quick-photo"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <Link
                to="/ai-assistant"
                state={{
                  from: "appi-floating",
                  conversationId: activeConversationId || null,
                  pageContext: pageContextForPath(location.pathname),
                }}
                onClick={closePanel}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-orange hover:text-brand-orange/75"
              >
                Workspace APPI
                <AapmIcon
                  name="solar:arrow-right-up-bold"
                  className="h-3 w-3"
                />
              </Link>
            </div>
          </footer>
        </section>
      )}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(isOpen) => !isOpen && setPendingDelete(null)}
        title="Hapus percakapan?"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” akan dihapus dari riwayat akun Anda dan tidak dapat dipulihkan.`
            : "Riwayat percakapan ini tidak dapat dipulihkan."
        }
        confirmLabel="Hapus percakapan"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={() => {
          const conversationId = pendingDelete?.id;
          setPendingDelete(null);
          if (conversationId) deleteConversation(conversationId);
        }}
      />
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          className="fixed bottom-5 right-5 z-[75] hidden h-12 items-center justify-start gap-2 rounded-full border border-border bg-background/95 py-1.5 pl-2 pr-2.5 shadow-[0_12px_28px_hsl(var(--foreground)/0.16)] ring-1 ring-brand-orange/10 backdrop-blur-xl transition-transform hover:-translate-y-0.5 hover:border-brand-orange/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 lg:inline-flex"
          aria-label="Buka APPI"
          aria-haspopup="dialog"
        >
          <AiProfileAvatar size="sm" state="idle" label="" />
          <span className="hidden flex-col sm:flex">
            <span className="text-sm font-semibold leading-4">Tanya APPI</span>
            <span className="mt-0.5 text-[10px] text-brand-orange/80">
              AAPM Intelligence
            </span>
          </span>
          <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-brand-orange text-white sm:flex">
            <AapmIcon name="solar:arrow-up-bold" className="h-3 w-3" />
          </span>
        </button>
      )}
    </>
  );
}
