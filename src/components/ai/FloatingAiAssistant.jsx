import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import AiAvatar from "@/components/ai/AiAvatar";
import { Button } from "@/components/primitives";
import { useAiChat } from "@/components/ai/AiChatProvider";

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

function BubbleAnswer({ content }) {
  return (
    <ReactMarkdown
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function BubbleThinking({ label }) {
  return (
    <div className="aapm-ai-thinking" aria-live="polite">
      <span className="aapm-ai-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        {label || "APPI menyusun jawaban"}
      </span>
    </div>
  );
}

export default function FloatingAiAssistant() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [input, setInput] = useState("");
  const [avatarState, setAvatarState] = useState("idle");
  const closeTimer = useRef(null);
  const endRef = useRef(null);
  const wasStreamingRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeConversationId,
    conversations,
    messages,
    isStreaming,
    streamStatus,
    startNewConversation,
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
    const lastMessage = messages.at(-1);
    if (isStreaming) {
      wasStreamingRef.current = true;
      setAvatarState(lastMessage?.content ? "responding" : "thinking");
      return undefined;
    }
    if (wasStreamingRef.current) {
      wasStreamingRef.current = false;
      setAvatarState(lastMessage?.error ? "alert" : "complete");
      const timer = window.setTimeout(() => setAvatarState("idle"), 1200);
      return () => window.clearTimeout(timer);
    }
    setAvatarState("idle");
    return undefined;
  }, [isStreaming, messages]);
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

  const openPanel = () => {
    setClosing(false);
    setOpen(true);
  };
  const closePanel = () => setClosing(true);
  const submit = async (text = input) => {
    const message = text.trim();
    if (!message || isStreaming) return;
    setInput("");
    await send(message, { includeFarm: true });
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
          className={`aapm-ai-panel fixed inset-x-0 bottom-0 z-[80] flex h-[min(78dvh,44rem)] min-h-0 flex-col overflow-hidden rounded-t-[1.5rem] border border-border bg-background shadow-[0_24px_60px_hsl(var(--foreground)/0.18)] sm:bottom-5 sm:left-auto sm:right-5 sm:h-[min(39rem,calc(100dvh-6.5rem))] sm:w-[25rem] sm:rounded-2xl ${closing ? "aapm-ai-panel--exit" : "aapm-ai-panel--enter"}`}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <AiAvatar size="md" state={avatarState} decorative />
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
                onClick={startNewConversation}
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
                      {message.content}
                    </div>
                  ) : (
                    <article
                      key={message.id}
                      className="max-w-full text-xs leading-5"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                        <AapmIcon
                          name="solar:stars-minimalistic-bold-duotone"
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
                        <BubbleThinking label={streamStatus} />
                      )}
                      {message.content && (
                        <div className="mt-2.5">
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
          <footer className="shrink-0 border-t border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <AapmIcon
                name="solar:chart-square-bold-duotone"
                className="h-3.5 w-3.5 text-brand-orange"
              />
              Konteks KPI digunakan saat tersedia.
            </div>
            <div className="flex items-end gap-2 rounded-xl border border-input bg-surface-elevated p-1.5 transition-colors focus-within:border-brand-orange">
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
                className="max-h-24 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-xs leading-5 outline-none"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => submit()}
                disabled={!input.trim() || isStreaming}
                className="h-8 w-8 shrink-0 rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90"
              >
                <AapmIcon
                  name="solar:plane-2-bold-duotone"
                  className="h-3.5 w-3.5"
                />
                <span className="sr-only">Kirim</span>
              </Button>
            </div>
            <Link
              to="/ai-assistant"
              onClick={closePanel}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-orange hover:text-brand-orange/75"
            >
              Buka semua percakapan{" "}
              <AapmIcon name="solar:arrow-right-up-bold" className="h-3 w-3" />
            </Link>
          </footer>
        </section>
      )}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          className="fixed bottom-4 right-4 z-[75] inline-flex h-12 items-center gap-2 rounded-full border border-white/35 bg-brand-orange py-1.5 pl-2 pr-3.5 text-left text-white shadow-[0_14px_32px_hsl(var(--aapm-orange-500)/0.36)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 sm:bottom-5 sm:right-5"
          aria-label="Buka APPI"
          aria-haspopup="dialog"
        >
          <AiAvatar size="md" state="idle" decorative />
          <span className="flex flex-col">
            <span className="text-sm font-semibold leading-4">Tanya APPI</span>
            <span className="mt-0.5 text-[10px] text-white/80">
              AAPM Intelligence
            </span>
          </span>
          <AapmIcon
            name="solar:arrow-up-bold"
            className="ml-0.5 h-3.5 w-3.5 text-white/85"
          />
        </button>
      )}
    </>
  );
}
