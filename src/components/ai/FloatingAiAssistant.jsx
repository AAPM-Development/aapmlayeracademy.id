import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiAvatar from "@/components/ai/AiAvatar";
import AiStreamActivity from "@/components/ai/AiStreamActivity";
import { Button, Switch } from "@/components/primitives";
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
    exam: "Final exam",
    admin: "Administrasi Academy",
    dashboard: "Dashboard Academy",
  };
  return labels[pageContextForPath(pathname)] || "Academy";
}

function filterConversations(conversations, query) {
  const keyword = query.trim().toLocaleLowerCase("id-ID");
  if (!keyword) return conversations;
  return conversations.filter((conversation) =>
    `${conversation.title || ""} ${conversation.lastMessagePreview || ""}`
      .toLocaleLowerCase("id-ID")
      .includes(keyword),
  );
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
  const [historyQuery, setHistoryQuery] = useState("");
  const [imageAttachment, setImageAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const closeTimer = useRef(null);
  const endRef = useRef(null);
  const imageInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeConversationId,
    conversations,
    messages,
    isStreaming,
    streamStatus,
    streamSteps,
    startNewConversation,
    selectConversation,
    deleteConversation,
    send,
  } = useAiChat();
  const activeConversation = conversations.find(
    (item) => item.id === activeConversationId,
  );

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);
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

  const visibleConversations = filterConversations(conversations, historyQuery);
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
    const image = imageAttachment?.dataUrl || null;
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
          className={`aapm-ai-panel fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)] z-[80] flex h-[min(74dvh,44rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_60px_hsl(var(--foreground)/0.18)] lg:bottom-5 lg:left-auto lg:right-5 lg:h-[min(39rem,calc(100dvh-6.5rem))] lg:w-[25rem] ${closing ? "aapm-ai-panel--exit" : "aapm-ai-panel--enter"}`}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tint-orange text-brand-orange">
                <AapmIcon
                  name="ai"
                  className="h-4 w-4"
                />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">APPI</h2>
                <p className="truncate text-[10px] text-muted-foreground">
                  {activeConversation?.title ||
                    "Siap membantu dari halaman ini"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
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
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="flex min-h-full flex-col gap-4">
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
                  className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-brand-green px-3 py-2 text-xs leading-5 text-white"
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
                      className="max-w-full text-xs leading-5"
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
                      {message.streaming && (
                        <AiStreamActivity
                          label={streamStatus}
                          steps={streamSteps}
                          compact
                          avatarState={message.content ? "responding" : "thinking"}
                        />
                      )}
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
                    </article>
                  ),
                )
              )}
              <div ref={endRef} />
              </div>
            </div>
            {historyOpen && (
              <aside
                aria-label="Riwayat percakapan APPI"
                className="aapm-ai-history-sheet absolute inset-0 z-20 flex min-h-0 flex-col bg-background"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
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
                <label className="m-3 flex items-center gap-2 rounded-xl border border-border bg-surface-subtle px-3 py-2.5 focus-within:border-brand-orange/45">
                  <AapmIcon
                    name="solar:magnifer-bold-duotone"
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <input
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder="Cari riwayat"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    aria-label="Cari riwayat percakapan"
                  />
                </label>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  <div className="space-y-1.5">
                    {visibleConversations.length === 0 && (
                      <p className="px-2 py-5 text-xs leading-5 text-muted-foreground">
                        {historyQuery
                          ? "Tidak ada percakapan yang cocok."
                          : "Belum ada riwayat percakapan."}
                      </p>
                    )}
                    {visibleConversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`group flex items-center gap-1 rounded-xl border p-1.5 ${conversation.id === activeConversationId ? "border-brand-orange/35 bg-tint-orange" : "border-transparent hover:border-border hover:bg-surface-subtle"}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            selectConversation(conversation.id);
                            setHistoryOpen(false);
                          }}
                          disabled={isStreaming}
                          className="min-w-0 flex-1 px-2 py-2 text-left"
                        >
                          <span className="block truncate text-xs font-semibold">
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
                              deleteConversation(conversation.id);
                            }
                          }}
                          disabled={isStreaming}
                          className="h-8 w-8 shrink-0 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
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
                </div>
              </aside>
            )}
          </div>
          <footer className="shrink-0 border-t border-border bg-background p-3">
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
                  className="h-8 w-8 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium">
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
                  <AapmIcon name="solar:close-circle-bold" className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <AapmIcon
                  name="solar:map-point-bold-duotone"
                  className="h-3.5 w-3.5 text-brand-orange"
                />
                {pageContextLabel(location.pathname)}
              </span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                <Switch
                  checked={allowWebSearch}
                  onCheckedChange={setAllowWebSearch}
                  disabled={isStreaming}
                  aria-label="Izinkan APPI mencari referensi web"
                  className="scale-75"
                />
                <AapmIcon
                  name="solar:global-bold-duotone"
                  className="h-3.5 w-3.5 text-brand-orange"
                />
                Cari web
              </label>
            </div>
            <div className="flex items-end gap-1.5 rounded-xl border border-input bg-surface-elevated p-1.5 transition-colors focus-within:border-brand-orange">
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
                placeholder="Tanyakan kondisi farm…"
                className="max-h-24 min-h-[2.25rem] flex-1 resize-none bg-transparent px-1 py-1.5 text-xs leading-5 outline-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => submit()}
                disabled={(!input.trim() && !imageAttachment) || isStreaming}
                className="h-8 w-8 shrink-0 rounded-lg text-brand-orange hover:bg-tint-orange hover:text-brand-orange"
              >
                <AapmIcon
                  name="solar:plain-2-bold"
                  className="h-4 w-4"
                />
                <span className="sr-only">Kirim</span>
              </Button>
            </div>
            {attachmentError && (
              <p className="mt-1.5 text-[10px] font-medium text-danger">
                {attachmentError}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <AapmIcon
                  name="solar:history-2-bold-duotone"
                  className="h-3 w-3 text-brand-orange"
                />
                Riwayat
              </button>
              <Link
                to="/ai-assistant"
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
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)] right-4 z-[75] inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background/95 p-1 shadow-[0_12px_28px_hsl(var(--foreground)/0.16)] ring-1 ring-brand-orange/10 backdrop-blur-xl transition-transform hover:-translate-y-0.5 hover:border-brand-orange/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 sm:w-auto sm:justify-start sm:gap-2 sm:rounded-full sm:py-1.5 sm:pl-2 sm:pr-2.5 lg:bottom-5 lg:right-5"
          aria-label="Buka APPI"
          aria-haspopup="dialog"
        >
          <AiAvatar size="md" state="idle" decorative />
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
