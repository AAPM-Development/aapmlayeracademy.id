import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AapmIcon from '@/components/icons/AapmIcon';
import AiAvatar from '@/components/ai/AiAvatar';
import { Button } from '@/components/primitives';
import { useAiChat } from '@/components/ai/AiChatProvider';

const quickRoutes = [
  { to: '/kpi', label: 'KPI farm', icon: 'solar:chart-square-bold-duotone' },
  { to: '/calculators', label: 'Kalkulator', icon: 'solar:calculator-bold-duotone' },
  { to: '/modules', label: 'Materi', icon: 'solar:notebook-bold-duotone' },
];

function BubbleAnswer({ content }) {
  return <ReactMarkdown components={{
    p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
    h1: ({ children }) => <h3 className="mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="mt-3 text-xs font-semibold first:mt-0">{children}</h4>,
    ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-4 marker:text-brand-orange">{children}</ul>,
    ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-4 marker:text-brand-orange">{children}</ol>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  }}>{content}</ReactMarkdown>;
}

function BubbleThinking({ label }) {
  return <div className="aapm-ai-thinking max-w-none"><AiAvatar size="xs" active decorative /><div><p className="text-xs font-semibold">{label || 'Menyusun jawaban'}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Respons muncul bertahap.</p></div></div>;
}

export default function FloatingAiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeConversationId, conversations, messages, isStreaming, streamStatus, startNewConversation, send } = useAiChat();
  const activeConversation = conversations.find((item) => item.id === activeConversationId);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, isStreaming]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (location.pathname === '/ai-assistant') return null;

  const submit = async () => {
    const message = input.trim();
    if (!message || isStreaming) return;
    setInput('');
    await send(message, { includeFarm: true });
  };

  return <>
    {open && <section role="dialog" aria-label="AI Farm Assistant cepat" className="fixed inset-x-3 bottom-3 top-[4.75rem] z-[80] flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_60px_hsl(var(--foreground)/0.18)] sm:bottom-5 sm:left-auto sm:right-5 sm:top-auto sm:h-[min(43rem,calc(100dvh-6.5rem))] sm:w-[27rem]"><header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex min-w-0 items-center gap-2.5"><AiAvatar size="md" active={isStreaming} decorative /><div className="min-w-0"><h2 className="truncate text-sm font-semibold">AI Farm Assistant</h2><p className="truncate text-[10px] text-muted-foreground">{activeConversation?.title || 'Percakapan baru'}</p></div></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" onClick={startNewConversation} disabled={isStreaming} className="h-8 w-8" aria-label="Percakapan baru"><AapmIcon name="solar:pen-new-square-bold" className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8" aria-label="Tutup AI Assistant"><AapmIcon name="solar:close-circle-bold" className="h-4 w-4" /></Button></div></header><div className="min-h-0 flex-1 overflow-y-auto px-4 py-4"><div className="flex min-h-full flex-col gap-4">{messages.length === 0 ? <div className="my-auto"><div className="flex items-center gap-3"><AiAvatar size="lg" active decorative /><div><p className="text-sm font-semibold">Bawa pertanyaan ke mana pun Anda bekerja.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Percakapan ini tersimpan di akun Anda dan bisa diteruskan di workspace penuh.</p></div></div><div className="mt-5 grid grid-cols-3 gap-2">{quickRoutes.map((item) => <button key={item.to} type="button" onClick={() => { setOpen(false); navigate(item.to); }} className="rounded-xl border border-border px-2 py-2.5 text-center text-[10px] text-muted-foreground transition-colors hover:border-brand-orange/35 hover:bg-tint-orange hover:text-foreground"><AapmIcon name={item.icon} className="mx-auto mb-1.5 h-4 w-4 text-brand-orange" />{item.label}</button>)}</div></div> : messages.map((message) => message.role === 'user' ? <div key={message.id} className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-brand-green px-3 py-2 text-xs leading-5 text-white">{message.content}</div> : <div key={message.id} className="max-w-full text-xs leading-5"><div className="mb-1 flex items-center gap-2 font-semibold"><AiAvatar size="xs" active={message.streaming} decorative /> AI Farm Assistant</div>{message.streaming && !message.content && <BubbleThinking label={streamStatus} />}{message.content && <BubbleAnswer content={message.content} />}{message.fallback && <p className="mt-2 text-[10px] text-brand-orange">{message.notice || 'Respons lokal tersimpan; provider dapat dicoba kembali di workspace penuh.'}</p>}{message.error && <p className="mt-2 text-[10px] text-danger">Permintaan belum dapat diproses.</p>}{!message.streaming && message.provider && <p className="mt-2 text-[10px] text-muted-foreground">{message.fallback ? 'Respons lokal tersimpan' : `${message.provider === 'openrouter' ? 'OpenRouter' : message.provider} · ${message.model}`}</p>}</div>)}<div ref={endRef} /></div></div><footer className="shrink-0 border-t border-border p-3"><div className="flex items-end gap-2 rounded-xl border border-input bg-surface-elevated p-1.5 focus-within:border-brand-orange"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={1} placeholder="Tanyakan kondisi farm…" className="max-h-24 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-xs leading-5 outline-none" /><Button type="button" size="icon" onClick={submit} disabled={!input.trim() || isStreaming} className="h-8 w-8 shrink-0 rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90"><AapmIcon name="solar:plane-2-bold-duotone" className="h-3.5 w-3.5" /><span className="sr-only">Kirim</span></Button></div><Link to="/ai-assistant" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-orange hover:text-brand-orange/75">Buka semua percakapan <AapmIcon name="solar:arrow-right-up-bold" className="h-3 w-3" /></Link></footer></section>}
    {!open && <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[75] inline-flex h-14 items-center gap-2.5 rounded-full border border-white/30 bg-brand-orange py-1.5 pl-1.5 pr-4 text-left text-white shadow-[0_14px_32px_hsl(var(--aapm-orange-500)/0.36)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2" aria-label="Buka AI Farm Assistant"><AiAvatar size="md" active decorative className="bg-white/95" /><span className="flex flex-col"><span className="text-sm font-semibold leading-4">Tanya AI</span><span className="mt-0.5 text-[10px] text-white/80">Asisten farm</span></span><AapmIcon name="solar:arrow-up-bold" className="ml-0.5 h-3.5 w-3.5 text-white/85" /></button>}
  </>;
}
