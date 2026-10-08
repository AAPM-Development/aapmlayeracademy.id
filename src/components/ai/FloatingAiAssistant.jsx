import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiProfileAvatar from "@/components/ai/AiProfileAvatar";
import AiMessageMeta from "@/components/ai/AiMessageMeta";
import AiStreamActivity from "@/components/ai/AiStreamActivity";
import useChatScrollFollow from "@/components/ai/useChatScrollFollow";
import useScrollEdgeFade from "@/lib/useScrollEdgeFade";
import AiActivityList from "@/components/ai/AiActivityList";
import {
  AiHistoryBulkBar,
  AiConversationHistoryResults,
  AiConversationRenameDialog,
  AiHistoryToolbar,
  useConversationManagement,
} from "@/components/ai/AiHistoryControls";
import AiComposer from "@/components/ai/AiComposer";
import AiQuickActions from "@/components/ai/AiQuickActions";
import { Button, ConfirmDialog, IconButton, Table, useToast } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { useFarmData, useModules, useUserProgress } from "@/lib/useCourseData";
import { personalizedSuggestions } from "@/lib/aiSuggestions";
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

function findLastAssistantMessageIndex(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") return index;
  }
  return -1;
}

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
        table: ({ children }) => <Table className="aapm-ai-markdown-table" aria-label="Tabel dalam jawaban APPI">{children}</Table>,
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [allowWebSearch, setAllowWebSearch] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyView, setHistoryView] = useState("chats");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySort, setHistorySort] = useState("updated");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingRename, setPendingRename] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const closeTimer = useRef(null);
  const imageInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: farm = [] } = useFarmData();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const {
    activeConversationId,
    conversations,
    conversationTotal,
    conversationActiveTotal,
    conversationArchivedTotal,
    conversationsLoading,
    conversationsRefreshing,
    conversationsError,
    hasMoreConversations,
    isLoadingMoreConversations,
    loadMoreConversations,
    refreshHistory,
    historyError,
    historySyncState,
    activity,
    activityLoading,
    messages,
    isStreaming,
    streamStatus,
    streamSteps,
    streamPhase,
    promptDraft,
    setPromptDraft,
    startNewConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    bulkArchiveConversations,
    bulkDeleteConversations,
    send,
    retryPersistAssistant,
    retryingMessageId,
  } = useAiChat();
  const activeConversation = conversations.find(
    (item) => item.id === activeConversationId,
  );
  const bubbleSuggestions = useMemo(
    () =>
      personalizedSuggestions({
        farm,
        modules,
        progress,
        user,
        pageContext: pageContextForPath(location.pathname),
      }),
    [farm, location.pathname, modules, progress, user],
  );
  const bubbleActions = useMemo(() => {
    const contextual = bubbleSuggestions.slice(0, 2).map((suggestion) => ({
      kind: "prompt",
      label: suggestion.label,
      detail: suggestion.detail,
      icon: "solar:stars-minimalistic-bold-duotone",
      prompt: suggestion.prompt,
    }));
    const routeAction = quickActions.find(
      (action) => action.kind === "route" && action.to !== location.pathname,
    );
    return routeAction ? [...contextual, routeAction] : contextual;
  }, [bubbleSuggestions, location.pathname]);
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
  const historyScrollRef = useScrollEdgeFade();
  const panelRef = useRef(null);
  const launcherRef = useRef(null);
  const wasOpenRef = useRef(false);

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
    if (open) {
      wasOpenRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        const target = panelRef.current?.querySelector("textarea") || panelRef.current;
        target?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      launcherRef.current?.focus({ preventScroll: true });
    }
    return undefined;
  }, [open]);
  useEffect(() => {
    if (!closing) return undefined;
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300);
    return () => window.clearTimeout(closeTimer.current);
  }, [closing]);

  const management = useConversationManagement({
    conversations,
    query: historyQuery,
    sort: historySort,
  });
  const {
    scope: historyScope,
    setScope: setHistoryScope,
    selectionMode: historySelectionMode,
    toggleSelectionMode: toggleHistorySelectionMode,
    selectedIds: historySelectedIds,
    selectedConversationIds: historySelectedConversationIds,
    selectedCount: historySelectedCount,
    visibleConversations,
    activeCount: historyActiveCount,
    archivedCount: historyArchivedCount,
    allVisibleSelected: historyAllVisibleSelected,
    toggleSelected: toggleHistorySelected,
    toggleAllVisible: toggleHistoryAllVisible,
    clearSelection: clearHistorySelection,
  } = management;

  if (location.pathname === "/ai-assistant") return null;
  const historySyncLabel = {
    saving: "Menyimpan di akun…",
    saved: "Tersimpan di akun",
    attention: "Periksa riwayat",
  }[historySyncState] || activeConversation?.title || "Siap membantu dari halaman ini";
  const lastAssistantMessageIndex = findLastAssistantMessageIndex(messages);
  const openPanel = () => {
    setClosing(false);
    setOpen(true);
  };
  const trapFocus = (event) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll("button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]")];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const closePanel = () => {
    setHistoryOpen(false);
    setClosing(true);
  };
  const submit = async (text = promptDraft) => {
    const message =
      text.trim() ||
      (imageAttachment
        ? "Tolong analisis foto farm ini dan sebutkan observasi yang perlu saya verifikasi di lapangan."
        : "");
    if (!message || isStreaming) return;
    const image = imageAttachment;
    const result = await send(message, {
      includeFarm: true,
      allowWebSearch,
      pageContext: pageContextForPath(location.pathname),
      image,
    });
    if (result?.ok) {
      setImageAttachment(null);
      setAttachmentError("");
    }
  };
  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setImageLoading(false);
      setAttachmentError("Gunakan foto JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImageLoading(false);
      setAttachmentError("Ukuran foto maksimal 3 MB.");
      return;
    }
    setImageLoading(true);
    setAttachmentError("");
    const reader = new FileReader();
    reader.onload = () => {
      setImageAttachment({ dataUrl: String(reader.result), name: file.name });
      setImageLoading(false);
      setAttachmentError("");
    };
    reader.onerror = () => {
      setImageLoading(false);
      setAttachmentError("Foto tidak dapat dibaca.");
    };
    reader.readAsDataURL(file);
  };
  const handleDeleteConversation = async (id) => {
    try {
      await deleteConversation(id);
      toast({ title: "Chat dihapus", description: "Percakapan telah dihapus dari riwayat akun Anda." });
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "Chat belum dihapus", description: error?.message || "Coba lagi beberapa saat lagi." });
      return false;
    }
  };
  const handleRenameConversation = async (id, title) => {
    try {
      await renameConversation(id, title);
      toast({ title: "Judul chat diperbarui", description: "Perubahan tersimpan di riwayat akun Anda." });
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "Judul belum disimpan", description: error?.message || "Coba lagi beberapa saat lagi." });
      return false;
    }
  };
  const handleArchiveConversation = async (id, archived) => {
    try {
      await archiveConversation(id, archived);
      toast({
        title: archived ? "Chat diarsipkan" : "Chat dipulihkan",
        description: archived
          ? "Percakapan dipindahkan ke arsip akun Anda."
          : "Percakapan kembali ke riwayat aktif.",
      });
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "Status chat belum berubah", description: error?.message || "Coba lagi beberapa saat lagi." });
      return false;
    }
  };
  const handleBulkArchive = async (ids, archived) => {
    try {
      const result = await bulkArchiveConversations(ids, archived);
      if (result.failed.length) {
        toast({ variant: "destructive", title: "Sebagian chat belum dipindahkan", description: `${result.updated.length} berhasil, ${result.failed.length} gagal.` });
      } else {
        toast({ title: archived ? "Chat diarsipkan" : "Chat dipulihkan", description: `${result.updated.length} percakapan diperbarui.` });
      }
      return result;
    } catch (error) {
      toast({ variant: "destructive", title: "Arsip belum diperbarui", description: error?.message || "Coba lagi beberapa saat lagi." });
      return { ok: false, updated: [], failed: ids.map((id) => ({ id, error })) };
    }
  };
  const handleBulkDelete = async (ids) => {
    try {
      const result = await bulkDeleteConversations(ids);
      if (result.failed.length) {
        toast({ variant: "destructive", title: "Sebagian chat belum dihapus", description: `${result.deleted.length} berhasil, ${result.failed.length} gagal.` });
      } else {
        toast({ title: "Chat dihapus", description: `${result.deleted.length} percakapan dihapus dari riwayat akun Anda.` });
      }
      return result;
    } catch (error) {
      toast({ variant: "destructive", title: "Chat belum dihapus", description: error?.message || "Coba lagi beberapa saat lagi." });
      return { ok: false, deleted: [], failed: ids.map((id) => ({ id, error })) };
    }
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
          className={`aapm-ai-floating-backdrop aapm-token-scrim fixed inset-0 z-[79] backdrop-blur-[1px] ${closing ? "aapm-ai-floating-backdrop--exit" : ""}`}
        />
      )}
      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="APPI cepat"
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={trapFocus}
          className={`aapm-ai-panel aapm-ai-floating-panel aapm-token-popover fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-[80] flex h-[min(72dvh,44rem)] min-h-0 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden sm:inset-x-4 sm:max-w-[calc(100vw-2rem)] lg:bottom-5 lg:left-auto lg:right-5 lg:h-[min(39rem,calc(100dvh-6.5rem))] lg:w-[25rem] ${closing ? "aapm-ai-panel--exit" : "aapm-ai-panel--enter"}`}
        >
          <header className="aapm-ai-floating-panel__header flex min-w-0 shrink-0 items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <AiProfileAvatar
                size="xs"
                state={isStreaming ? streamPhase : "idle"}
              />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="truncate text-sm font-semibold tracking-[-0.01em]">APPI</h2>
                  <span
                    className="aapm-ai-floating-panel__status-dot"
                    data-state={historySyncState}
                    aria-hidden="true"
                  />
                </div>
                <p className="aapm-ai-floating-panel__status-line truncate text-xs text-muted-foreground" aria-live="polite">
                  {historySyncLabel}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                type="button"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                disabled={isStreaming}
                label="Buka riwayat percakapan"
                tooltip="Buka riwayat percakapan"
                className="aapm-ai-floating-panel__icon-button"
              >
                <AapmIcon name="communication" />
              </IconButton>
              <IconButton
                type="button"
                size="sm"
                onClick={() => {
                  setHistoryOpen(false);
                  startNewConversation();
                }}
                disabled={isStreaming}
                label="Percakapan baru"
                tooltip="Percakapan baru"
                className="aapm-ai-floating-panel__icon-button"
              >
                <AapmIcon name="edit" />
              </IconButton>
              <IconButton
                type="button"
                onClick={closePanel}
                label="Tutup APPI"
                tooltip="Tutup APPI"
                className="aapm-ai-floating-panel__icon-button"
              >
                <AapmIcon name="close" />
              </IconButton>
            </div>
          </header>
          <div className="aapm-ai-floating-panel__body relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
            <div
              ref={chatViewportRef}
              role="log"
              aria-label="Transkrip percakapan APPI cepat"
              className="aapm-ai-floating-transcript aapm-scroll-fade min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-24 pt-4"
            >
              <div className="flex min-h-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden">
              {historyError && !conversationsError && (
                <div className="aapm-ai-alert flex min-w-0 items-center justify-between gap-2 border border-tint-orange-border bg-tint-orange px-2.5 py-2 text-[10px] leading-4 text-tint-orange-foreground">
                  <span className="min-w-0">Riwayat belum tersinkron.</span>
                  <button type="button" onClick={refreshHistory} className="shrink-0 font-semibold text-brand-orange">Coba lagi</button>
                </div>
              )}
              {messages.length === 0 ? (
                <div className="my-auto pb-2">
                  <p className="text-sm font-semibold tracking-[-0.015em]">
                    Tanya APPI tentang {pageContextLabel(location.pathname)}.
                  </p>
                  <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                    KPI aktif dapat ikut dibaca. Percakapan ini tersimpan khusus
                    di akun Anda.
                  </p>
                  <div className="aapm-ai-card aapm-ai-quick-actions-card mt-5 divide-y divide-border/60">
                    <p className="px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
                      AKSI CEPAT
                    </p>
                    {bubbleActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleAction(action)}
                        className="aapm-ai-quick-action group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-tint-orange/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-tint-orange text-brand-orange">
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
                messages.map((message, index) =>
                  message.role === "user" ? (
                    <div
                  key={message.id}
                  className="aapm-ai-user-bubble ml-auto min-w-0 max-w-[86%] break-words px-3 py-2 text-xs [overflow-wrap:anywhere]"
                >
                      {message.image?.dataUrl && (
                        <img
                          src={message.image.dataUrl}
                          alt="Foto yang dikirim untuk dianalisis"
                          className="mb-2 max-h-40 w-full rounded-[var(--radius-control)] object-cover"
                        />
                      )}
                      {message.content}
                    </div>
                  ) : (
                    <article
                      key={message.id}
                      className="min-w-0 max-w-full break-words text-xs leading-5"
                      aria-label="Jawaban APPI"
                    >
                      {message.streaming && <span className="sr-only">APPI sedang menjawab</span>}
                      {message.streaming && (
                        <AiStreamActivity
                          label={streamStatus}
                          steps={streamSteps}
                          compact
                          showSteps={false}
                        />
                      )}
                      {message.content && (
                        <div
                          className={`aapm-ai-response aapm-ai-answer-card aapm-ai-answer-card--compact ${message.streaming ? "aapm-ai-response--streaming" : ""} mt-2.5`}
                        >
                          <BubbleAnswer content={message.content} />
                        </div>
                      )}
                      <AiMessageMeta
                        message={message}
                        onRetryPersistence={retryPersistAssistant}
                        persistenceRetrying={retryingMessageId === message.id}
                        disabled={isStreaming}
                        compact
                        showMeta={index === lastAssistantMessageIndex || !message.persisted}
                      />
                      {index === lastAssistantMessageIndex && !message.streaming && !message.error && (
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
                className="aapm-token-control absolute bottom-[5.7rem] left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-foreground backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
              >
                <AapmIcon name="chevronDown" className="h-3 w-3 text-brand-orange" />
                Ke terbaru
              </button>
            )}
            {historyOpen && (
              <aside
                aria-label="Riwayat percakapan APPI"
                className="aapm-ai-history-sheet aapm-token-sheet absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden"
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
                    totalConversationCount={conversationTotal}
                    activityCount={activity.length}
                    onRefresh={refreshHistory}
                    isRefreshing={conversationsRefreshing}
                    scope={historyScope}
                    onScopeChange={setHistoryScope}
                    activeCount={conversationActiveTotal ?? historyActiveCount}
                    archivedCount={conversationArchivedTotal ?? historyArchivedCount}
                    selectionMode={historySelectionMode}
                    onToggleSelectionMode={toggleHistorySelectionMode}
                    selectedCount={historySelectedCount}
                    compact
                  />
                </div>
                {historyView === "chats" && historySelectionMode && (
                  <AiHistoryBulkBar
                    scope={historyScope}
                    selectedCount={historySelectedCount}
                    allVisibleSelected={historyAllVisibleSelected}
                    onToggleAll={toggleHistoryAllVisible}
                    onArchive={async () => {
                      if (!historySelectedCount || bulkBusy) return;
                      setBulkBusy(true);
                      try {
                        await handleBulkArchive(historySelectedConversationIds, historyScope === "active");
                        clearHistorySelection();
                      } finally {
                        setBulkBusy(false);
                      }
                    }}
                    onDelete={() => setPendingBulkDelete(true)}
                    onCancel={clearHistorySelection}
                    disabled={isStreaming || bulkBusy}
                  />
                )}
                <div ref={historyScrollRef} className="aapm-ai-history-scroll aapm-scroll-fade min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3">
                  {historyView === "activity" ? (
                    <div className="min-w-0 max-w-full pt-3">
                      <AiActivityList activity={activity} loading={activityLoading} />
                    </div>
                  ) : (
                    <div className="min-w-0 max-w-full pt-3">
                      <AiConversationHistoryResults
                        conversations={visibleConversations}
                        activeConversationId={activeConversationId}
                        loading={conversationsLoading}
                        error={conversationsError}
                        disabled={isStreaming}
                        onRetry={refreshHistory}
                        onSelect={(conversationId) => {
                          if (historySelectionMode) {
                            toggleHistorySelected(conversationId);
                            return;
                          }
                          selectConversation(conversationId);
                          setHistoryOpen(false);
                        }}
                        onDelete={setPendingDelete}
                        onRename={setPendingRename}
                        onArchive={handleArchiveConversation}
                        selectable={historySelectionMode}
                        selectedIds={historySelectedIds}
                        onToggleSelect={toggleHistorySelected}
                        hasMore={hasMoreConversations && !historyQuery}
                        onLoadMore={loadMoreConversations}
                        isLoadingMore={isLoadingMoreConversations}
                        emptyMessage="Belum ada percakapan."
                        filtered={Boolean(historyQuery)}
                      />
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
          <footer className="aapm-ai-floating-composer shrink-0 p-2.5 sm:p-3">
            <AiComposer
              input={promptDraft}
              setInput={setPromptDraft}
              onSubmit={() => submit()}
              isStreaming={isStreaming}
              imageInputRef={imageInputRef}
              onImageSelection={handleImageSelection}
              imageLoading={imageLoading}
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
            <div className="aapm-ai-floating-composer__link-row mt-1.5 flex items-center justify-end gap-2 px-0.5">
              <Link
                to="/ai-assistant"
                state={{
                  from: "appi-floating",
                  conversationId: activeConversationId || null,
                  pageContext: pageContextForPath(location.pathname),
                }}
                onClick={closePanel}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-brand-orange"
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
          if (conversationId) handleDeleteConversation(conversationId);
        }}
      />
      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={(isOpen) => !isOpen && !bulkBusy && setPendingBulkDelete(false)}
        title={`Hapus ${historySelectedCount} percakapan?`}
        description="Percakapan terpilih akan dihapus dari riwayat akun dan tidak dapat dipulihkan."
        confirmLabel="Hapus terpilih"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={async () => {
          setPendingBulkDelete(false);
          setBulkBusy(true);
          try {
            await handleBulkDelete(historySelectedConversationIds);
            clearHistorySelection();
          } finally {
            setBulkBusy(false);
          }
        }}
      />
      <AiConversationRenameDialog
        conversation={pendingRename}
        onOpenChange={(isOpen) => !isOpen && !renaming && setPendingRename(null)}
        saving={renaming}
        onRename={async (id, title) => {
          setRenaming(true);
          try {
            const renamed = await handleRenameConversation(id, title);
            if (renamed !== false) setPendingRename(null);
          } finally {
            setRenaming(false);
          }
        }}
      />
      {!open && (
        <button
          type="button"
          ref={launcherRef}
          onClick={openPanel}
          className="aapm-ai-launcher aapm-token-popover fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-[75] inline-flex h-10 w-10 items-center justify-center p-1 sm:bottom-5 sm:right-5 sm:h-10 sm:w-auto sm:justify-start sm:gap-1.5 sm:py-1 sm:pl-1.5 sm:pr-2"
          aria-label="Buka APPI"
          aria-haspopup="dialog"
        >
          <AiProfileAvatar size="xs" state="idle" label="" />
          <span className="hidden text-xs font-semibold leading-4 text-foreground sm:inline">Tanya APPI</span>
        </button>
      )}
    </>
  );
}
