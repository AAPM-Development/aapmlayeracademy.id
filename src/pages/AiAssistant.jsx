import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useLocation } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiProfileAvatar from "@/components/ai/AiProfileAvatar";
import AiQuickActions from "@/components/ai/AiQuickActions";
import AiStreamActivity from "@/components/ai/AiStreamActivity";
import useChatScrollFollow from "@/components/ai/useChatScrollFollow";
import AiActivityList from "@/components/ai/AiActivityList";
import {
  AiConversationRow,
  AiHistoryToolbar,
  filterAndSortConversations,
} from "@/components/ai/AiHistoryControls";
import AiComposer from "@/components/ai/AiComposer";
import { Button, ConfirmDialog, ScrollArea } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";
import { getNextModule } from "@/lib/academyData";
import { useFarmData, useModules, useUserProgress } from "@/lib/useCourseData";
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

function personalizedSuggestions({ farm = [], progress = [], modules = [], user, pageContext = "" }) {
  const displayName = user?.fullName || user?.full_name || "Anda";
  const name = displayName.split(" ")[0] || "Anda";
  const latest = farm.at(-1);
  const previous = farm.at(-2);
  const completed = progress.filter(
    (item) => item?.completed && Number(item.moduleNumber) > 0,
  ).length;
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

function AssistantMessage({
  message,
  retryPrompt,
  onRetry,
  onQuickAction,
  pathname,
  disabled,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const canCollapse = !message.streaming && message.content.length > 1150;
  return (
    <article className="aapm-ai-message w-full min-w-0 max-w-2xl overflow-hidden">
      <div className="mb-2 flex items-center gap-2">
        <AapmIcon
          name="ai"
          className="h-4 w-4 text-brand-orange"
        />
        <span className="text-sm font-semibold tracking-[-0.015em]">APPI</span>
      </div>
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
      {!message.streaming && !message.error && (
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
  activity,
  activeConversationId,
  loading,
  activityLoading,
  disabled,
  onSelect,
  onDelete,
  onNew,
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("chats");
  const [sort, setSort] = useState("updated");
  const [pendingDelete, setPendingDelete] = useState(null);
  const visibleConversations = filterAndSortConversations(
    conversations,
    query,
    sort,
  );

  return (
    <aside className="aapm-ai-conversation-sidebar hidden w-72 min-w-0 shrink-0 overflow-hidden border-r border-border bg-surface-subtle/25 lg:flex lg:flex-col">
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
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
      <div className="px-3 pb-2 pt-1">
        <AiHistoryToolbar
          view={view}
          onViewChange={setView}
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          onClearQuery={() => setQuery("")}
          conversationCount={conversations.length}
          activityCount={activity.length}
          compact
        />
      </div>
      <ScrollArea className="aapm-ai-history-scroll min-h-0 min-w-0 w-full max-w-full flex-1 px-2 pb-3">
        {view === "activity" ? (
          <div className="min-w-0 max-w-full px-2 pt-3">
            <AiActivityList activity={activity} loading={activityLoading} />
          </div>
        ) : <div className="min-w-0 max-w-full space-y-1">
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
            <AiConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeConversationId}
              disabled={disabled}
              onSelect={onSelect}
              onDelete={setPendingDelete}
            />
          ))}
        </div>}
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
    </aside>
  );
}

function MobileConversationSheet({
  open,
  conversations,
  activity,
  activeConversationId,
  loading,
  activityLoading,
  disabled,
  onClose,
  onSelect,
  onDelete,
  onNew,
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("chats");
  const [sort, setSort] = useState("updated");
  const [pendingDelete, setPendingDelete] = useState(null);
  const visibleConversations = filterAndSortConversations(
    conversations,
    query,
    sort,
  );

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
        className="fixed inset-x-0 bottom-0 z-[85] flex h-[min(84dvh,44rem)] min-h-[28rem] w-full max-w-[100vw] min-w-0 flex-col overflow-hidden rounded-t-[1.5rem] border-x border-t border-border bg-background shadow-[0_-18px_52px_hsl(var(--foreground)/0.2)] lg:hidden"
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
            activityCount={activity.length}
          />
        </div>
        <ScrollArea className="aapm-ai-history-scroll min-h-0 min-w-0 w-full max-w-full flex-1 px-3 py-3">
          {view === "activity" ? (
            <div className="min-w-0 max-w-full"><AiActivityList activity={activity} loading={activityLoading} /></div>
          ) : <div className="min-w-0 max-w-full space-y-1.5">
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
              <AiConversationRow
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeConversationId}
                disabled={disabled}
                onSelect={onSelect}
                onDelete={setPendingDelete}
              />
            ))}
          </div>}
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
  const initialOpenRef = useRef(false);
  const imageInputRef = useRef(null);
  const location = useLocation();
  const { data: farm = [] } = useFarmData();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const { user } = useAuth();
  const {
    conversations,
    conversationsLoading,
    activity,
    activityLoading,
    activeConversationId,
    messages,
    isLoadingConversation,
    isStreaming,
    streamStatus,
    streamSteps,
    streamPhase,
    selectConversation,
    startNewConversation,
    deleteConversation,
    send,
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
  const contextLabel = includeFarm
    ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI aktif`
    : "Tanpa konteks KPI";
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
      return;
    }
    startNewConversation();
  }, [
    activeConversationId,
    conversationsLoading,
    location.state,
    selectConversation,
    startNewConversation,
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
    await send(message, { includeFarm, allowWebSearch, image, pageContext: "ai-assistant" });
  };

  return (
    <div className="aapm-ai-workspace flex h-[calc(100dvh-8.6rem-env(safe-area-inset-bottom))] min-h-[31rem] w-full min-w-0 max-w-full overflow-hidden bg-background lg:h-[calc(100dvh-73px)] lg:min-h-[33rem]">
      <ConversationList
        conversations={conversations}
        activity={activity}
        activeConversationId={activeConversationId}
        loading={conversationsLoading}
        activityLoading={activityLoading}
        disabled={isStreaming}
        onSelect={selectConversation}
        onDelete={deleteConversation}
        onNew={startNewConversation}
      />
      <section className="flex min-w-0 max-w-full flex-1 flex-col overflow-hidden">
        <header className="aapm-ai-workspace__header flex min-h-[3.75rem] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <AiProfileAvatar
              size="sm"
              state={isStreaming ? streamPhase : "idle"}
            />
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
        <div className="relative flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
          <ScrollArea
            viewportRef={chatViewportRef}
            aria-label="Transkrip percakapan APPI"
            className="aapm-ai-transcript aapm-chat-scroll min-h-0 min-w-0 max-w-full flex-1 overflow-hidden"
          >
            <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col overflow-x-hidden px-4 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-9">
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
                  <div className="aapm-ai-suggestion-grid mt-8 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => submit(suggestion.prompt)}
                        className="group min-w-0 rounded-xl border border-border bg-surface-default px-3.5 py-3 text-left text-xs leading-5 text-muted-foreground transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-orange/35 hover:bg-tint-orange hover:text-foreground hover:shadow-[0_8px_22px_hsl(var(--aapm-orange-700)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex min-w-0 items-start gap-2.5">
                          <AapmIcon
                            name="solar:stars-minimalistic-bold-duotone"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          />
                          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                            <span className="block font-semibold text-foreground">
                              {suggestion.label}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                              {suggestion.detail}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 max-w-full flex-col gap-7 sm:gap-9">
                  {messages.map((message, index) =>
                    message.role === "user" ? (
                      <div key={message.id} className="flex min-w-0 max-w-full justify-end">
                        <div className="min-w-0 max-w-[84%] break-words rounded-2xl rounded-br-md bg-brand-green px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm [overflow-wrap:anywhere] sm:max-w-[88%]">
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
                        message={{ ...message, streamStatus, streamSteps }}
                        retryPrompt={
                          message.fallback ? messages[index - 1]?.content : ""
                        }
                        onRetry={submit}
                        onQuickAction={submit}
                        pathname={location.state?.pageContext || location.pathname}
                        disabled={isStreaming}
                      />
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
              className="absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-[0_8px_24px_hsl(var(--foreground)/0.12)] backdrop-blur transition hover:-translate-y-0.5 hover:border-brand-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
            >
              <AapmIcon name="chevronDown" className="h-3.5 w-3.5 text-brand-orange" />
              Ke pesan terbaru
            </button>
          )}
        </div>
        <div className="aapm-ai-composer-dock min-w-0 max-w-full shrink-0 overflow-hidden border-t border-border bg-background px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:py-4">
          <div className="mx-auto min-w-0 max-w-3xl">
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
              includeFarm={includeFarm}
              onIncludeFarmChange={setIncludeFarm}
              allowWebSearch={allowWebSearch}
              onAllowWebSearchChange={setAllowWebSearch}
              contextLabel={contextLabel}
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
        activity={activity}
        activeConversationId={activeConversationId}
        loading={conversationsLoading}
        activityLoading={activityLoading}
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
    </div>
  );
}
