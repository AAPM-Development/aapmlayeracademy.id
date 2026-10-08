import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiProfileAvatar from "@/components/ai/AiProfileAvatar";
import AiQuickActions from "@/components/ai/AiQuickActions";
import AiMessageMeta from "@/components/ai/AiMessageMeta";
import AiStreamActivity from "@/components/ai/AiStreamActivity";
import useChatScrollFollow from "@/components/ai/useChatScrollFollow";
import AiActivityList from "@/components/ai/AiActivityList";
import {
  AiHistoryBulkBar,
  AiConversationHistoryResults,
  AiConversationRenameDialog,
  AiHistoryToolbar,
  useConversationManagement,
} from "@/components/ai/AiHistoryControls";
import AiComposer from "@/components/ai/AiComposer";
import { Button, ConfirmDialog, ScrollArea, Table, useToast } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { getCompletedModuleSet, getNextModule } from "@/lib/academyData";
import { useFarmData, useModules, useUserProgress } from "@/lib/useCourseData";
import { useAiChat } from "@/components/ai/AiChatProvider";

const MermaidDiagram = React.lazy(
  () => import("@/components/ai/MermaidDiagram"),
);

const welcomeMessage =
  "Bawa situasi yang Anda lihat di farm. Saya bantu mengurai sinyal, menyusun urutan pemeriksaan, lalu merumuskan langkah berikutnya.";

function findLastAssistantMessageIndex(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") return index;
  }
  return -1;
}

function personalizedSuggestions({ farm = [], progress = [], modules = [], user, pageContext = "" }) {
  const displayName = user?.fullName || user?.full_name || "Anda";
  const name = displayName.split(" ")[0] || "Anda";
  const latest = farm.at(-1);
  const previous = farm.at(-2);
  const completed = getCompletedModuleSet(progress, modules).size;
  const nextModule = getNextModule(modules, progress);
  const nextModuleLabel = nextModule
    ? `Modul ${nextModule.moduleNumber}: ${nextModule.title}`
    : "modul Academy yang belum selesai";
  const finite = (value) => Number.isFinite(Number(value));
  const formatValue = (value) =>
    finite(value)
      ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value))
      : "—";
  const weekLabel = latest?.week ? `minggu ${latest.week}` : "catatan terbaru";
  const hdp = Number(latest?.henDayProduction);
  const previousHdp = Number(previous?.henDayProduction);
  const hdpDelta = finite(hdp) && finite(previousHdp) ? hdp - previousHdp : null;
  const missingFields = latest
    ? [
        ["feedIntake", "pakan"],
        ["waterIntake", "air"],
        ["eggWeight", "berat telur"],
        ["mortality", "mortalitas"],
        ["temperature", "suhu"],
        ["humidity", "kelembapan"],
        ["fcr", "FCR"],
      ]
        .filter(([key]) => !finite(latest[key]))
        .map(([, label]) => label)
      : [];
  const suggestions = [];
  const add = (id, label, detail, prompt) =>
    suggestions.push({ id, label, detail, prompt });

  if (!latest) {
    add(
      "baseline",
      "Bangun baseline farm",
      "Tentukan data minimum untuk mulai membaca performa.",
      `${name}, saya belum memiliki catatan KPI farm. Susun lima data baseline yang perlu saya catat minggu ini, lengkap dengan satuan, periode, dan cara mengecek konsistensinya.`,
    );
    add(
      "daily-log",
      "Siapkan catatan harian",
      "Buat format sederhana yang siap dipakai tim lapangan.",
      "Buatkan format catatan harian farm yang ringkas untuk HDP, pakan, air, berat telur, mortalitas, suhu, dan kelembapan.",
    );
  } else {
    const changeText =
      hdpDelta === null
        ? "perbandingan minggu sebelumnya belum tersedia"
        : `${hdpDelta >= 0 ? "naik" : "turun"} ${formatValue(Math.abs(hdpDelta))} poin dari minggu sebelumnya`;
    add(
      "latest-signal",
      "Baca sinyal terbaru",
      `${weekLabel} · HDP ${formatValue(hdp)}% · ${changeText}`,
      finite(hdp)
        ? `HDP ${weekLabel} saya ${formatValue(hdp)}%${finite(previousHdp) ? `, dibanding ${formatValue(previousHdp)}% pada minggu sebelumnya` : ""}. Susun tiga pemeriksaan prioritas, data pembanding yang perlu saya siapkan, dan batas kesimpulan yang aman.`
        : `Baca sinyal operasional dari ${weekLabel} dan susun urutan pemeriksaan yang paling masuk akal sebelum saya menarik kesimpulan.`,
    );
    add(
      "context-gap",
      "Lengkapi konteks KPI",
      missingFields.length
        ? `Belum ada: ${missingFields.slice(0, 4).join(", ")}${missingFields.length > 4 ? ", dan lainnya" : ""}.`
        : "Semua kolom utama sudah terisi; cek konsistensi antarperiode.",
      missingFields.length
        ? `Untuk ${weekLabel}, data ${missingFields.join(", ")} belum tercatat. Urutkan data mana yang paling penting dilengkapi lebih dulu dan jelaskan mengapa data itu dibutuhkan untuk membaca HDP atau FCR.`
        : `Data KPI ${weekLabel} sudah cukup lengkap. Buatkan pemeriksaan konsistensi antarperiode agar angka yang tampak berubah tidak langsung dianggap sebagai masalah farm.`,
    );
    add(
      "feed-output",
      "Hubungkan pakan dan output",
      finite(latest.fcr)
        ? `FCR tercatat ${formatValue(latest.fcr)} · bedakan sinyal dari data yang belum pasti.`
        : "Gunakan feed intake, egg mass, dan FCR secara berurutan.",
      finite(latest.fcr)
        ? `FCR ${formatValue(latest.fcr)} pada ${weekLabel}. Jelaskan data pendamping yang wajib dibaca sebelum menilai efisiensi, termasuk kemungkinan masalah satuan atau pembagian dengan nol.`
        : `Susun urutan analisis hubungan feed intake, egg mass, dan FCR untuk data farm saya, termasuk data yang masih perlu dicatat.`,
    );
  }

  if (pageContext === "kpi") {
    add(
      "kpi-decision",
      "Validasi sebelum bertindak",
      "Ubah angka KPI menjadi pemeriksaan lapangan yang aman.",
      "Dari data KPI akun saya, buatkan tabel sinyal, data yang perlu divalidasi, kemungkinan penyebab, dan tindakan pertama. Pisahkan fakta dari hipotesis.",
    );
  } else if (pageContext === "calculators") {
    add(
      "calculator-check",
      "Periksa hasil hitung",
      "Pastikan rumus, satuan, dan keputusan tidak melenceng.",
      "Bantu saya memeriksa hasil kalkulator yang sedang saya gunakan: jelaskan asumsi rumus, satuan yang harus cocok, dan bagaimana hasilnya diterjemahkan menjadi keputusan farm.",
    );
  } else if (pageContext === "learning") {
    add(
      "next-learning",
      "Lanjutkan belajar dengan arah",
      `${completed} modul selesai · fokus berikutnya: ${nextModuleLabel}.`,
      `Saya sudah menyelesaikan ${completed} modul. Buatkan rencana belajar singkat untuk melanjutkan ke ${nextModuleLabel}, lalu kaitkan dengan masalah KPI farm yang sedang saya hadapi.`,
    );
  } else if (pageContext === "certification" || pageContext === "exam") {
    add(
      "readiness",
      "Ukur kesiapan belajar",
      `${completed} modul selesai · cari gap yang paling penting.`,
      `Dengan ${completed} modul selesai, buatkan checklist kesiapan belajar saya untuk sertifikasi/ujian. Tunjukkan gap yang perlu saya tutup tanpa mengarang nilai atau menjanjikan kelulusan.`,
    );
  } else {
    add(
      "next-action",
      "Pilih langkah berikutnya",
      `${completed} modul selesai · tetap selaraskan belajar dengan praktik farm.`,
      completed
        ? `Saya sudah menyelesaikan ${completed} modul. Materi atau latihan apa yang paling relevan untuk memperkuat evaluasi KPI saya saat ini? Jelaskan alasannya.`
        : "Saya baru mulai belajar. Urutkan fokus pertama yang paling penting untuk memahami performa layer farm dan langsung beri satu latihan praktis.",
    );
  }

  return suggestions.slice(0, 4);
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

function AssistantMessage({
  message,
  retryPrompt,
  onRetry,
  onRetryPersistence,
  persistenceRetrying = false,
  onQuickAction,
  pathname,
  disabled,
  showAssistantLabel = false,
  showQuickActions = true,
  showMeta = true,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const canCollapse = !message.streaming && message.content.length > 1150;
  return (
    <article
      className="aapm-ai-message w-full min-w-0 max-w-2xl overflow-hidden"
      aria-label="Jawaban APPI"
    >
      {showAssistantLabel && (
        <div className="mb-2 flex items-center gap-2">
          <AapmIcon
            name="ai"
            className="h-4 w-4 text-brand-orange"
          />
          <span className="text-sm font-semibold tracking-[-0.015em]">APPI</span>
        </div>
      )}
      {message.streaming && (
        <AiStreamActivity
          label={message.streamStatus}
          steps={message.streamSteps}
          showSteps={!message.content}
        />
      )}
      {message.content && (
        <>
          <div
            className={`aapm-ai-response aapm-ai-answer-card ${message.streaming ? "aapm-ai-response--streaming" : ""} relative mt-2.5 text-sm leading-6 text-foreground ${canCollapse && collapsed ? "max-h-56 overflow-hidden" : ""}`}
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
      <AiMessageMeta
        message={message}
        retryPrompt={retryPrompt}
        onRetry={onRetry}
        onRetryPersistence={onRetryPersistence}
        persistenceRetrying={persistenceRetrying}
        disabled={disabled}
        showMeta={showMeta}
      />
      {showQuickActions && !message.streaming && !message.error && !message.fallback && (
        <AiQuickActions
          content={message.content}
          pathname={pathname}
          onSelect={onQuickAction}
          disabled={disabled}
        />
      )}
    </article>
  );
}

function ConversationList({
  conversations,
  conversationTotal,
  conversationActiveTotal,
  conversationArchivedTotal,
  activity,
  activeConversationId,
  loading,
  error,
  refreshing,
  hasMore,
  loadingMore,
  activityLoading,
  disabled,
  onSelect,
  onDelete,
  onRename,
  onArchive,
  onBulkArchive,
  onBulkDelete,
  onNew,
  onRefresh,
  onLoadMore,
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("chats");
  const [sort, setSort] = useState("updated");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingRename, setPendingRename] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const management = useConversationManagement({ conversations, query, sort });
  const {
    scope,
    setScope,
    selectionMode,
    toggleSelectionMode,
    selectedIds,
    selectedConversationIds,
    selectedCount,
    visibleConversations,
    activeCount,
    archivedCount,
    allVisibleSelected,
    toggleSelected,
    toggleAllVisible,
    clearSelection,
  } = management;

  return (
    <aside aria-label="Riwayat percakapan" className="aapm-ai-conversation-sidebar hidden w-72 min-w-0 shrink-0 overflow-hidden border-r border-border lg:flex lg:flex-col">
      <div className="px-3 pb-2 pt-3">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onNew}
          disabled={disabled}
          className="w-full justify-start gap-2 px-3"
        >
          <AapmIcon
            name="solar:pen-new-square-bold"
            className="h-4 w-4 text-brand-orange"
          />
          Percakapan baru
        </Button>
      </div>
      <div className="px-3 pb-2">
        <AiHistoryToolbar
          view={view}
          onViewChange={setView}
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          onClearQuery={() => setQuery("")}
          conversationCount={conversations.length}
          totalConversationCount={conversationTotal}
          activityCount={activity.length}
          onRefresh={onRefresh}
          isRefreshing={refreshing}
          scope={scope}
          onScopeChange={setScope}
          activeCount={conversationActiveTotal ?? activeCount}
          archivedCount={conversationArchivedTotal ?? archivedCount}
          selectionMode={selectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          selectedCount={selectedCount}
          compact
        />
      </div>
      {view === "chats" && selectionMode && (
        <AiHistoryBulkBar
          scope={scope}
          selectedCount={selectedCount}
          allVisibleSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          onArchive={async () => {
            if (!selectedCount || bulkBusy) return;
            setBulkBusy(true);
            try {
              await onBulkArchive(selectedConversationIds, scope === "active");
              clearSelection();
            } finally {
              setBulkBusy(false);
            }
          }}
          onDelete={() => setPendingBulkDelete(true)}
          onCancel={clearSelection}
          disabled={disabled || bulkBusy}
        />
      )}
      <ScrollArea className="aapm-ai-history-scroll aapm-scroll-fade min-h-0 min-w-0 w-full max-w-full flex-1 px-2 pb-3">
        {view === "activity" ? (
          <div className="min-w-0 max-w-full px-2 pt-3">
            <AiActivityList activity={activity} loading={activityLoading} />
          </div>
        ) : (
          <div className="min-w-0 max-w-full pt-2">
            <AiConversationHistoryResults
              conversations={visibleConversations}
              activeConversationId={activeConversationId}
              loading={loading}
              error={error}
              disabled={disabled}
              onRetry={onRefresh}
              onSelect={(id) => (selectionMode ? toggleSelected(id) : onSelect(id))}
              onDelete={setPendingDelete}
              onRename={setPendingRename}
              onArchive={async (conversation, archived) => {
                await onArchive(conversation.id, archived);
              }}
              selectable={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelected}
              hasMore={hasMore && !query}
              onLoadMore={onLoadMore}
              isLoadingMore={loadingMore}
              emptyMessage="Belum ada percakapan."
              filtered={Boolean(query)}
            />
          </div>
        )}
      </ScrollArea>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
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
          if (conversationId) onDelete(conversationId);
        }}
      />
      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={(open) => !open && !bulkBusy && setPendingBulkDelete(false)}
        title={`Hapus ${selectedCount} percakapan?`}
        description="Percakapan terpilih akan dihapus dari riwayat akun dan tidak dapat dipulihkan."
        confirmLabel="Hapus terpilih"
        icon="solar:trash-bin-trash-bold"
        destructive
        onConfirm={async () => {
          setPendingBulkDelete(false);
          setBulkBusy(true);
          try {
            await onBulkDelete(selectedConversationIds);
            clearSelection();
          } finally {
            setBulkBusy(false);
          }
        }}
      />
      <AiConversationRenameDialog
        conversation={pendingRename}
        onOpenChange={(open) => !open && !renaming && setPendingRename(null)}
        saving={renaming}
        onRename={async (id, title) => {
          setRenaming(true);
          try {
            const renamed = await onRename(id, title);
            if (renamed !== false) setPendingRename(null);
          } finally {
            setRenaming(false);
          }
        }}
      />
    </aside>
  );
}

function MobileConversationSheet({
  open,
  conversations,
  conversationTotal,
  conversationActiveTotal,
  conversationArchivedTotal,
  activity,
  activeConversationId,
  loading,
  error,
  refreshing,
  hasMore,
  loadingMore,
  activityLoading,
  disabled,
  onClose,
  onSelect,
  onDelete,
  onRename,
  onArchive,
  onBulkArchive,
  onBulkDelete,
  onNew,
  onRefresh,
  onLoadMore,
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("chats");
  const [sort, setSort] = useState("updated");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingRename, setPendingRename] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const management = useConversationManagement({ conversations, query, sort });
  const {
    scope,
    setScope,
    selectionMode,
    toggleSelectionMode,
    selectedIds,
    selectedConversationIds,
    selectedCount,
    visibleConversations,
    activeCount,
    archivedCount,
    allVisibleSelected,
    toggleSelected,
    toggleAllVisible,
    clearSelection,
  } = management;

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
        className="aapm-ai-history-sheet aapm-token-sheet fixed inset-x-0 bottom-0 z-[85] flex h-[min(84dvh,44rem)] min-h-[28rem] w-full max-w-[100vw] min-w-0 flex-col overflow-hidden rounded-t-[var(--radius-overlay)] border-x border-t border-border lg:hidden"
      >
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Percakapan</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Tersimpan khusus di akun Anda
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
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
        <div className="min-w-0 max-w-full px-3 pb-1 pt-3">
          <AiHistoryToolbar
            view={view}
            onViewChange={setView}
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            onClearQuery={() => setQuery("")}
            conversationCount={conversations.length}
            totalConversationCount={conversationTotal}
            activityCount={activity.length}
            onRefresh={onRefresh}
            isRefreshing={refreshing}
            scope={scope}
            onScopeChange={setScope}
            activeCount={conversationActiveTotal ?? activeCount}
            archivedCount={conversationArchivedTotal ?? archivedCount}
            selectionMode={selectionMode}
            onToggleSelectionMode={toggleSelectionMode}
            selectedCount={selectedCount}
          />
        </div>
        {view === "chats" && selectionMode && (
          <AiHistoryBulkBar
            scope={scope}
            selectedCount={selectedCount}
            allVisibleSelected={allVisibleSelected}
            onToggleAll={toggleAllVisible}
            onArchive={async () => {
              if (!selectedCount || bulkBusy) return;
              setBulkBusy(true);
              try {
                await onBulkArchive(selectedConversationIds, scope === "active");
                clearSelection();
              } finally {
                setBulkBusy(false);
              }
            }}
            onDelete={() => setPendingBulkDelete(true)}
            onCancel={clearSelection}
            disabled={disabled || bulkBusy}
          />
        )}
        <ScrollArea className="aapm-ai-history-scroll aapm-scroll-fade min-h-0 min-w-0 w-full max-w-full flex-1 px-3 py-3">
          {view === "activity" ? (
            <div className="min-w-0 max-w-full"><AiActivityList activity={activity} loading={activityLoading} /></div>
          ) : (
            <div className="min-w-0 max-w-full">
              <AiConversationHistoryResults
                conversations={visibleConversations}
                activeConversationId={activeConversationId}
                loading={loading}
                error={error}
                disabled={disabled}
                onRetry={onRefresh}
                onSelect={(id) => (selectionMode ? toggleSelected(id) : onSelect(id))}
                onDelete={setPendingDelete}
                onRename={setPendingRename}
                onArchive={async (conversation, archived) => {
                  await onArchive(conversation.id, archived);
                }}
                selectable={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelected}
                hasMore={hasMore && !query}
                onLoadMore={onLoadMore}
                isLoadingMore={loadingMore}
                emptyMessage="Belum ada percakapan."
                filtered={Boolean(query)}
              />
            </div>
          )}
        </ScrollArea>
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
            if (conversationId) onDelete(conversationId);
          }}
        />
        <ConfirmDialog
          open={pendingBulkDelete}
          onOpenChange={(isOpen) => !isOpen && !bulkBusy && setPendingBulkDelete(false)}
          title={`Hapus ${selectedCount} percakapan?`}
          description="Percakapan terpilih akan dihapus dari riwayat akun dan tidak dapat dipulihkan."
          confirmLabel="Hapus terpilih"
          icon="solar:trash-bin-trash-bold"
          destructive
          onConfirm={async () => {
            setPendingBulkDelete(false);
            setBulkBusy(true);
            try {
              await onBulkDelete(selectedConversationIds);
              clearSelection();
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
              const renamed = await onRename(id, title);
              if (renamed !== false) setPendingRename(null);
            } finally {
              setRenaming(false);
            }
          }}
        />
      </aside>
    </>
  );
}

function StreamAnnouncer({ isStreaming }) {
  const [text, setText] = useState("");
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (isStreaming) {
      wasStreaming.current = true;
      setText("APPI sedang menjawab.");
      return;
    }
    if (wasStreaming.current) {
      wasStreaming.current = false;
      setText("APPI selesai menjawab.");
    }
  }, [isStreaming]);
  return <div className="aapm-visually-hidden" role="status" aria-live="polite">{text}</div>;
}

export default function AiAssistant() {
  const { toast } = useToast();
  const [includeFarm, setIncludeFarm] = useState(true);
  const [allowWebSearch, setAllowWebSearch] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const initialOpenRef = useRef(false);
  const imageInputRef = useRef(null);
  const location = useLocation();
  const { data: farm = [] } = useFarmData();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { user } = useAuth();
  const {
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
    activeConversationId,
    messages,
    isLoadingConversation,
    isStreaming,
    streamStatus,
    streamSteps,
    streamPhase,
    promptDraft,
    setPromptDraft,
    selectConversation,
    startNewConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    bulkArchiveConversations,
    bulkDeleteConversations,
    send,
    retryPersistAssistant,
    retryingMessageId,
  } = useAiChat();
  const suggestionContext = location.state?.pageContext || "ai-assistant";
  const suggestions = useMemo(
    () =>
      personalizedSuggestions({
        farm,
        progress,
        modules,
        user,
        pageContext: suggestionContext,
      }),
    [farm, modules, progress, suggestionContext, user],
  );
  const farmAvailable = farm.length > 0;
  const activeConversation =
    activeConversationId == null
      ? null
      : conversations.find((item) => String(item.id) === String(activeConversationId));
  const firstPrompt = messages.find((item) => item.role === "user")?.content?.trim() || "";
  const headerTitle = activeConversation?.title?.trim() || firstPrompt || "Percakapan baru";
  const historySyncMeta = {
    idle: { label: "Riwayat akun", icon: "solar:history-2-bold-duotone", className: "bg-surface-subtle text-muted-foreground" },
    saving: { label: "Menyimpan chat", icon: "loading", className: "bg-tint-orange text-tint-orange-foreground" },
    saved: { label: "Tersimpan", icon: "solar:check-circle-bold-duotone", className: "bg-tint-green text-tint-green-foreground" },
    attention: { label: "Periksa riwayat", icon: "solar:info-circle-bold-duotone", className: "bg-tint-orange text-tint-orange-foreground" },
  }[historySyncState] || { label: "Riwayat akun", icon: "solar:history-2-bold-duotone", className: "bg-surface-subtle text-muted-foreground" };
  const lastAssistantMessageIndex = findLastAssistantMessageIndex(messages);

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
      toast({
        variant: "destructive",
        title: "Status chat belum berubah",
        description: error?.message || "Coba lagi beberapa saat lagi.",
      });
      return false;
    }
  };
  const handleBulkArchive = async (ids, archived) => {
    try {
      const result = await bulkArchiveConversations(ids, archived);
      if (result.failed.length) {
        toast({
          variant: "destructive",
          title: "Sebagian chat belum dipindahkan",
          description: `${result.updated.length} berhasil, ${result.failed.length} gagal.`,
        });
      } else {
        toast({
          title: archived ? "Chat diarsipkan" : "Chat dipulihkan",
          description: `${result.updated.length} percakapan diperbarui.`,
        });
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
        toast({
          variant: "destructive",
          title: "Sebagian chat belum dihapus",
          description: `${result.deleted.length} berhasil, ${result.failed.length} gagal.`,
        });
      } else {
        toast({ title: "Chat dihapus", description: `${result.deleted.length} percakapan dihapus dari riwayat akun Anda.` });
      }
      return result;
    } catch (error) {
      toast({ variant: "destructive", title: "Chat belum dihapus", description: error?.message || "Coba lagi beberapa saat lagi." });
      return { ok: false, deleted: [], failed: ids.map((id) => ({ id, error })) };
    }
  };
  useEffect(() => {
    if (initialOpenRef.current || conversationsLoading) return;
    initialOpenRef.current = true;
    const handoffId =
      location.state?.from === "appi-floating"
        ? String(location.state.conversationId || "")
        : "";
    if (handoffId) {
      // The floating surface and workspace share one provider. If the same
      // conversation is already active, keep its in-memory streaming answer;
      // reloading the detail here could race the final assistant insert.
      if (String(activeConversationId || "") !== handoffId) {
        selectConversation(handoffId);
      }
    }
  }, [
    activeConversationId,
    conversationsLoading,
    location.state,
    selectConversation,
  ]);

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

  const submit = async (text = promptDraft) => {
    const content = text.trim();
    if ((!content && !imageAttachment) || isStreaming) return;
    const image = imageAttachment;
    const message =
      content ||
      "Tolong analisis foto farm ini. Bedakan observasi visual, hal yang belum pasti, dan data yang perlu saya cek berikutnya.";
    const result = await send(message, { includeFarm: includeFarm && farmAvailable, allowWebSearch, image, pageContext: "ai-assistant" });
    if (result?.ok) {
      setImageAttachment(null);
      setAttachmentError("");
    }
  };

  return (
    <div className="aapm-ai-workspace aapm-ai-workspace--full-mobile aapm-ai-frame flex min-h-0 w-full min-w-0 max-w-full overflow-hidden lg:h-[calc(100dvh-73px)] lg:min-h-[33rem]">
      <ConversationList
        conversations={conversations}
        conversationTotal={conversationTotal}
        conversationActiveTotal={conversationActiveTotal}
        conversationArchivedTotal={conversationArchivedTotal}
        activity={activity}
        activeConversationId={activeConversationId}
        loading={conversationsLoading}
        error={conversationsError}
        refreshing={conversationsRefreshing}
        hasMore={hasMoreConversations}
        loadingMore={isLoadingMoreConversations}
        activityLoading={activityLoading}
        disabled={isStreaming}
        onSelect={selectConversation}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
        onArchive={handleArchiveConversation}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
        onNew={startNewConversation}
        onRefresh={refreshHistory}
        onLoadMore={loadMoreConversations}
      />
      <section className="aapm-ai-workspace__main flex min-w-0 max-w-full flex-1 flex-col overflow-hidden">
        <header className="aapm-ai-workspace__header flex min-h-[3.75rem] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-default px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <AiProfileAvatar
              size="sm"
              state={isStreaming ? streamPhase : "idle"}
            />
            <div className="min-w-0">
              <h1 className="aapm-chat-header__title">{headerTitle}</h1>
              <p className="aapm-chat-header__meta">APPI · riwayat tersimpan di akun Anda</p>
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
            {historySyncState === "saving" || historySyncState === "attention" ? (
              <span
                role="status"
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${historySyncMeta.className}`}
              >
                <AapmIcon
                  name={historySyncMeta.icon}
                  className={`h-3 w-3 ${historySyncState === "saving" ? "animate-spin" : ""}`}
                />
                {historySyncMeta.label}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              disabled={isStreaming}
              className="h-8 gap-1.5 px-2.5 text-xs lg:hidden"
            >
              <AapmIcon
                name="solar:pen-new-square-bold"
                className="h-3.5 w-3.5"
              />
              Baru
            </Button>
          </div>
        </header>
        <div className="relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
          <StreamAnnouncer isStreaming={isStreaming} />
          <ScrollArea
            viewportRef={chatViewportRef}
            role="log"
            aria-live="off"
            aria-busy={isStreaming}
            aria-label="Transkrip percakapan APPI"
            className="aapm-ai-transcript aapm-chat-scroll aapm-scroll-fade min-h-0 min-w-0 max-w-full flex-1 overflow-hidden"
          >
            <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col overflow-x-hidden px-4 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-9">
              {historyError && !conversationsError && (
                <div className="aapm-ai-alert mb-5 flex min-w-0 items-center justify-between gap-3 border border-tint-orange-border bg-tint-orange px-3 py-2.5 text-xs text-tint-orange-foreground">
                  <span className="min-w-0">Riwayat belum tersinkron. Chat Anda tidak dihapus.</span>
                  <button type="button" onClick={refreshHistory} className="shrink-0 font-semibold text-brand-orange hover:text-brand-orange/75">
                    Coba lagi
                  </button>
                </div>
              )}
              {isLoadingConversation ? (
                <p className="text-sm text-muted-foreground">
                  Memuat riwayat...
                </p>
              ) : messages.length === 0 ? (
                <div className="aapm-chat-welcome">
                  <span className="aapm-chat-welcome__mark"><AapmIcon name="ai" /></span>
                  <h2 className="aapm-chat-welcome__title">Halo! Apa yang terjadi di farm hari ini?</h2>
                  <p className="aapm-chat-welcome__text">{welcomeMessage}</p>
                  <div className="aapm-chat-suggestions">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => submit(suggestion.prompt)}
                        className="aapm-chat-suggestion"
                        data-hue={["green","blue","orange","violet"][index % 4]}
                      >
                        <span className="aapm-icon-tile" data-size="sm" data-shape="circle" data-variant="badge" data-hue={["green","blue","orange","violet"][index % 4]}><AapmIcon name="ai" /></span>
                        <span className="min-w-0">
                          <span className="aapm-chat-suggestion__title">{suggestion.label}</span>
                          <span className="aapm-chat-suggestion__detail">{suggestion.detail}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 max-w-full flex-col gap-6 sm:gap-8">
                  {messages.map((message, index) =>
                    message.role === "user" ? (
                      <div key={message.id} className="aapm-chat-turn aapm-chat-turn--user min-w-0 max-w-full">
                        <div className="aapm-ai-user-bubble aapm-chat-bubble min-w-0 max-w-[84%] break-words px-3.5 py-2.5 text-sm leading-6 [overflow-wrap:anywhere] sm:max-w-[88%]">
                          {message.image?.dataUrl && (
                            <img
                              src={message.image.dataUrl}
                              alt="Foto yang dikirim untuk dianalisis"
                              className="mb-2.5 max-h-56 w-full rounded-[var(--radius-control)] object-cover"
                            />
                          )}
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div key={message.id} className="aapm-chat-turn">
                        <span className="aapm-chat-turn__avatar" aria-hidden="true">
                          <AiProfileAvatar
                            size="xs"
                            label=""
                            state={message.streaming ? (message.content ? "responding" : "thinking") : "idle"}
                          />
                        </span>
                        <div className="aapm-chat-turn__body">
                      <AssistantMessage
                        key={message.id}
                        message={{ ...message, streamStatus, streamSteps }}
                        retryPrompt={
                          message.fallback || message.error ? messages[index - 1]?.content : ""
                        }
                        onRetry={submit}
                        onQuickAction={submit}
                        onRetryPersistence={retryPersistAssistant}
                        persistenceRetrying={retryingMessageId === message.id}
                        pathname={location.state?.pageContext || location.pathname}
                        disabled={isStreaming}
                        showAssistantLabel={false}
                        showQuickActions={index === lastAssistantMessageIndex}
                        showMeta={index === lastAssistantMessageIndex || !message.persisted}
                      />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          {showJumpToLatest && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="aapm-chat-jump"
            >
              <AapmIcon name="chevronDown" className="h-3.5 w-3.5 text-brand-orange" />
              Ke pesan terbaru
            </button>
          )}
        </div>
        <div className="aapm-ai-composer-dock min-w-0 max-w-full shrink-0 overflow-hidden border-t border-border bg-surface-default px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:py-4">
          <div className="mx-auto min-w-0 max-w-3xl">
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
              includeFarm={includeFarm && farmAvailable}
              onIncludeFarmChange={setIncludeFarm}
              farmAvailable={farmAvailable}
              allowWebSearch={allowWebSearch}
              onAllowWebSearchChange={setAllowWebSearch}
              showFarmToggle
              showPrivacy
              idPrefix="appi-workspace-photo"
            />
          </div>
        </div>
      </section>
      <MobileConversationSheet
        open={historyOpen}
        conversations={conversations}
        conversationTotal={conversationTotal}
        conversationActiveTotal={conversationActiveTotal}
        conversationArchivedTotal={conversationArchivedTotal}
        activity={activity}
        activeConversationId={activeConversationId}
        loading={conversationsLoading}
        error={conversationsError}
        refreshing={conversationsRefreshing}
        hasMore={hasMoreConversations}
        loadingMore={isLoadingMoreConversations}
        activityLoading={activityLoading}
        disabled={isStreaming}
        onClose={() => setHistoryOpen(false)}
        onSelect={(id) => {
          selectConversation(id);
          setHistoryOpen(false);
        }}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
        onArchive={handleArchiveConversation}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
        onNew={() => {
          startNewConversation();
          setHistoryOpen(false);
        }}
        onRefresh={refreshHistory}
        onLoadMore={loadMoreConversations}
      />
    </div>
  );
}
