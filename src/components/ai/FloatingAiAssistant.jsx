import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiMessageMeta from "@/components/ai/AiMessageMeta";
import AiResponseDetails from "@/components/ai/AiResponseDetails";
import AiThinking from "@/components/ai/AiThinking";
import AiJumpToLatest from "@/components/ai/AiJumpToLatest";
import useChatScrollFollow from "@/components/ai/useChatScrollFollow";
import useChatSubmit, { answerPrompts, findLastAssistantMessageIndex } from "@/components/ai/useChatSubmit";
import useLauncherClearance from "@/components/ai/useLauncherClearance";
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
import StreamAnnouncer from "@/components/ai/StreamAnnouncer";
import useModalFocus from "@/components/ai/useModalFocus";
import AiQuickActions from "@/components/ai/AiQuickActions";
import { Button, ConfirmDialog, useToast } from "@/components/primitives";
import AiMarkdown from "@/components/ai/AiMarkdown";
import AiCopyButton from "@/components/ai/AiCopyButton";
import AiSources from "@/components/ai/AiSources";
import { useAuth } from "@/lib/AuthContext";
import { useFarmData, useModules, useUserProgress } from "@/lib/useCourseData";
import { personalizedSuggestions } from "@/lib/aiSuggestions";
import { useAiChat } from "@/components/ai/AiChatProvider";
import AppiMascot, { appiAsset } from "@/components/appi/AppiMascot";
import { Ic } from "@/design-system/canvas";
import { ASK_APPI_EVENT } from "@/lib/askAppi";

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
  if (pathname === "/modules" || pathname.startsWith("/modules/") || pathname.startsWith("/quiz/")) {
    return "learning";
  }
  if (pathname === "/certification") return "certification";
  if (pathname === "/final-exam") return "exam";
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

/** @param {{ showLauncher?: boolean }} props */
export default function FloatingAiAssistant({ showLauncher = true }) {
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
  const closeTimer = useRef(null);
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
    isLoadingConversation,
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
    stopStreaming,
    retryPersistAssistant,
    retryingMessageId,
  } = useAiChat();
  const activeConversation = conversations.find(
    (item) => activeConversationId != null && String(item.id) === String(activeConversationId),
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
  const {
    submit,
    retryAnswer,
    imageInputRef,
    handleImageSelection,
    imageAttachment,
    removeImage,
    imageLoading,
    attachmentError,
  } = useChatSubmit({
    includeFarm: true,
    allowWebSearch,
    pageContext: pageContextForPath(location.pathname),
    composerField: () => panelRef.current?.querySelector("textarea"),
  });
  const wasOpenRef = useRef(false);
  useLauncherClearance(launcherRef, !open && showLauncher && location.pathname !== "/ai-assistant");

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

  const historyOverlayRef = useModalFocus({
    open: historyOpen,
    onClose: () => setHistoryOpen(false),
  });
  // Pages hand APPI a prepared question (a calculator result, the week's KPI);
  // the learner reviews it in the composer before sending.
  useEffect(() => {
    const onAsk = (event) => {
      const prompt = event.detail?.prompt;
      if (prompt) setPromptDraft(prompt);
      if (location.pathname === "/ai-assistant") return;
      setHistoryOpen(false);
      setClosing(false);
      setOpen(true);
    };
    window.addEventListener(ASK_APPI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_APPI_EVENT, onAsk);
  }, [location.pathname, setPromptDraft]);
  // The APPI workspace is the chat itself; everywhere else the launcher stays.
  if (location.pathname === "/ai-assistant") return null;
  const historySyncLabel = isStreaming
    ? "APPI sedang menjawab"
    : {
    saving: "Menyimpan di akun…",
    saved: "Tersimpan di akun",
    attention: "Periksa riwayat",
  }[historySyncState] || activeConversation?.title || "Siap membantu dari halaman ini";
  const lastAssistantMessageIndex = findLastAssistantMessageIndex(messages);
  const openPanel = () => {
    setClosing(false);
    setOpen(true);
  };
  const closePanel = () => {
    setHistoryOpen(false);
    setClosing(true);
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
        <section
          role="dialog"
          aria-modal="false"
          aria-label="APPI cepat"
          ref={panelRef}
          tabIndex={-1}
          className={`card card-raised stack appi-panel aapm-ai-panel aapm-ai-floating-panel ${closing ? "aapm-ai-panel--exit" : "aapm-ai-panel--enter"}`}
        >
          <header className="row gap-2 appi-panel-head">
            <span className="tile tile-round" data-hue="ai" style={{ overflow: "hidden" }}><AppiMascot mood={isStreaming ? (streamPhase === "alert" ? "concerned" : "think") : "idle"} size="sm" /></span>
            <div className="stack grow" style={{ minWidth: 0, paddingLeft: "var(--s-1)" }}>
              <h2 className="t-heading">APPI</h2>
              <span className="row gap-1-5 t-caption t-muted">
                <i className="appi-status-dot" data-state={historySyncState} aria-hidden="true" />
                <span className="t-clamp-1">{messages.length ? historySyncLabel : "Siap membantu dari halaman ini"}</span>
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Buka riwayat percakapan" onClick={() => setHistoryOpen(true)} disabled={isStreaming}><Ic name="history" /></button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Percakapan baru" onClick={() => { setHistoryOpen(false); startNewConversation(); }} disabled={isStreaming}><Ic name="edit" /></button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Tutup APPI" onClick={closePanel}><Ic name="x" /></button>
          </header>
          <div className="aapm-ai-floating-panel__body relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
            <StreamAnnouncer isStreaming={isStreaming} failed={streamPhase === "alert"} stopped={streamPhase === "stopped"} />
            <div
              ref={chatViewportRef}
              role="log"
              aria-live="off"
              aria-busy={isStreaming}
              aria-label="Transkrip percakapan APPI cepat"
              className="aapm-ai-floating-transcript aapm-scroll-fade appi-panel-scroll"
            >
              <div className="stack gap-4" style={{ minWidth: 0 }}>
              {historyError && !conversationsError && (
                <div className="aapm-ai-alert flex min-w-0 items-center justify-between gap-2 border border-tint-orange-border bg-tint-orange px-2.5 py-2 text-[11px] leading-4 text-tint-orange-foreground">
                  <span className="min-w-0">Riwayat belum tersinkron.</span>
                  <button type="button" onClick={refreshHistory} className="shrink-0 font-semibold text-brand-orange">Coba lagi</button>
                </div>
              )}
              {isLoadingConversation ? (
                <p className="t-caption t-muted" role="status">Memuat riwayat…</p>
              ) : messages.length === 0 ? (
                <div className="stack gap-4">
                  <div className="appi-says">
                    <div className="appi-stage"><AppiMascot mood="wink" size="md" enter="slide" /></div>
                    <div className="bubble bubble-ai tail-left stack gap-1 grow appi-say">
                      <p>Tanya APPI tentang <strong>{pageContextLabel(location.pathname)}</strong>.</p>
                      <p className="t-caption t-muted">KPI aktif ikut dibaca. Percakapan tersimpan di akun Anda.</p>
                    </div>
                  </div>
                  <section className="card" aria-labelledby="appi-qa-title">
                    <h3 className="t-overline t-muted" id="appi-qa-title" style={{ padding: "var(--s-3) var(--s-4) var(--s-1)" }}>Aksi cepat</h3>
                    <div className="list">
                      {bubbleActions.map((action, actionIndex) => (
                        <button key={action.label} type="button" className="li appi-quick" data-hue={["green", "orange", "teal", "blue"][actionIndex % 4]} onClick={() => handleAction(action)}>
                          <span className="tile tile-sm tile-round tile-solid"><AapmIcon name={action.icon} /></span>
                          <span className="stack grow" style={{ minWidth: 0 }}><span className="li-title">{action.label}</span><span className="li-meta t-clamp-1">{action.detail}</span></span>
                          <Ic name="chev-right" className="t-muted" />
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                messages.map((message, index) => {
                  if (message.role === "user") return (
                    <div key={message.id} className="stack gap-2" style={{ minWidth: 0 }}>
                      {message.image?.dataUrl ? <img src={message.image.dataUrl} alt="Foto yang dikirim untuk dianalisis" className="card msg-photo" /> : null}
                      {message.content ? <p className="msg-user msg-user-sm">{message.content}</p> : null}
                    </div>
                  );
                  const { retryPrompt, regeneratePrompt } = answerPrompts(messages, index);
                  return (
                    <article key={message.id} className="msg-appi msg-appi-sm" aria-label="Jawaban APPI">
                      <AppiMascot mood={message.streaming ? (message.content ? "talk" : "think") : "talk"} animated={Boolean(message.streaming)} size="xs" />
                      <div className="stack gap-2" style={{ minWidth: 0 }}>
                        {message.streaming && <span className="sr-only">APPI sedang menjawab</span>}
                        <AiThinking message={message} label={message.streaming ? streamStatus : ""} steps={message.streaming ? streamSteps : []} compact />
                        {message.content ? (
                          <div className={`aapm-ai-response msg-text msg-text-sm ${message.streaming ? "aapm-ai-response--streaming" : ""}`}>
                            <AiMarkdown content={message.content} compact streaming={message.streaming} />
                          </div>
                        ) : null}
                        {message.content && !message.streaming ? <AiSources sources={message.sources} /> : null}
                        {message.content && !message.streaming ? (
                          <div className="row wrap gap-1 answer-actions">
                            <AiCopyButton text={message.content} label="Salin" rich />
                            {regeneratePrompt ? (
                              <button type="button" className="btn btn-ghost btn-sm btn-quiet" disabled={isStreaming} onClick={() => retryAnswer(regeneratePrompt)}>
                                <Ic name="refresh" />Buat ulang
                              </button>
                            ) : null}
                            <AiMessageMeta message={message} retryPrompt={retryPrompt} onRetry={retryAnswer} onRetryPersistence={retryPersistAssistant} persistenceRetrying={retryingMessageId === message.id} disabled={isStreaming} compact showMeta={index === lastAssistantMessageIndex || !message.persisted} />
                          </div>
                        ) : (
                          <AiMessageMeta message={message} retryPrompt={retryPrompt} onRetry={retryAnswer} onRetryPersistence={retryPersistAssistant} persistenceRetrying={retryingMessageId === message.id} disabled={isStreaming} compact showMeta={index === lastAssistantMessageIndex || !message.persisted} />
                        )}
                        {!message.streaming ? <AiResponseDetails message={message} compact /> : null}
                        {index === lastAssistantMessageIndex && !message.streaming && !message.error && !message.fallback && (
                          <AiQuickActions content={message.content} pathname={location.pathname} onSelect={submit} disabled={isStreaming} compact />
                        )}
                      </div>
                    </article>
                  );
                })
              )}
              <div ref={chatEndRef} />
              </div>
            </div>
            {showJumpToLatest && <AiJumpToLatest onClick={jumpToLatest} />}
            {historyOpen && (
              <aside
                aria-label="Riwayat percakapan APPI"
                ref={historyOverlayRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className="aapm-ai-history-sheet aapm-token-sheet absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden"
              >
                <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Riwayat chat</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Tersimpan di akun Anda
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
          <footer className="stack gap-2 appi-panel-foot aapm-ai-floating-composer">
            <AiComposer
              input={promptDraft}
              setInput={setPromptDraft}
              onSubmit={() => submit()}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              disabled={isLoadingConversation}
              imageInputRef={imageInputRef}
              onImageSelection={handleImageSelection}
              imageLoading={imageLoading}
              imageAttachment={imageAttachment}
              onRemoveImage={removeImage}
              attachmentError={attachmentError}
              allowWebSearch={allowWebSearch}
              onAllowWebSearchChange={setAllowWebSearch}
              contextLabel={pageContextLabel(location.pathname)}
              placeholder="Tanyakan situasi di halaman ini…"
              compact
              showFarmToggle={false}
              idPrefix="appi-quick-photo"
            />
            <div className="row wrap between gap-1" style={{ padding: "0 var(--s-1)" }}>
              <Link
                to="/ai-assistant"
                state={{
                  from: "appi-floating",
                  conversationId: activeConversationId || null,
                  pageContext: pageContextForPath(location.pathname),
                }}
                onClick={closePanel}
                className="btn btn-link btn-sm"
              >
                Buka workspace APPI<Ic name="external" />
              </Link>
              <span className="t-caption t-muted">Penyakit atau dosis obat? Tanyakan dokter hewan.</span>
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
      {!open && showLauncher && (
        <button
          type="button"
          ref={launcherRef}
          onClick={openPanel}
          className="launcher launcher-fixed"
          data-appi-launcher=""
          aria-label="Buka APPI"
          aria-haspopup="dialog"
        >
          <img src={appiAsset(1)} alt="" />
          <span className="launcher-label" aria-hidden="true">Tanya APPI</span>
        </button>
      )}
    </>
  );
}
