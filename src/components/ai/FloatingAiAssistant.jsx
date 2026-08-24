import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AapmIcon from '@/components/icons/AapmIcon';
import { Button } from '@/components/primitives';
import { nativeApi } from '@/api/nativeClient';
import { useFarmData } from '@/lib/useCourseData';

const quickRoutes = [
  { to: '/kpi', label: 'Buka KPI', icon: 'kpi' },
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
  return <div className="aapm-ai-thinking max-w-none"><span className="aapm-ai-orbit" aria-hidden="true"><span /><span /><span /></span><div><p className="text-xs font-semibold">{label || 'Menyusun jawaban'}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Respons muncul bertahap.</p></div></div>;
}

export default function FloatingAiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const endRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { data: farm = [] } = useFarmData();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (location.pathname === '/ai-assistant') return null;

  const send = async () => {
    const message = input.trim();
    if (!message || isStreaming) return;
    const assistantId = `bubble-ai-${Date.now()}`;
    setMessages((current) => [...current, { id: `bubble-user-${Date.now()}`, role: 'user', content: message }, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
    setInput('');
    setIsStreaming(true);
    setStreamStatus('Membaca konteks farm');
    const updateAssistant = (update) => setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, ...update } : item));
    try {
      await nativeApi.ai.stream({
        message,
        farmContext: farm.length ? farm.slice(-8) : null,
        onEvent: ({ event, data }) => {
          if (event === 'status') setStreamStatus(data.label || 'Menyusun jawaban');
          if (event === 'delta' && data.text) setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `${item.content}${data.text}` } : item));
          if (event === 'notice') updateAssistant({ notice: data.text || '', fallback: true });
          if (event === 'done') updateAssistant({ streaming: false, provider: data.provider, model: data.model, fallback: Boolean(data.fallback) });
        },
      });
      updateAssistant({ streaming: false });
    } catch (exception) {
      updateAssistant({ streaming: false, content: exception?.message || 'Koneksi ke asisten belum tersedia.', error: true });
    } finally {
      setIsStreaming(false);
      setStreamStatus('');
    }
  };

  const startNew = () => {
    if (!isStreaming) setMessages([]);
  };

  return <>
    {open && <section role="dialog" aria-label="AI Farm Assistant cepat" className="fixed inset-x-3 bottom-3 top-[5.25rem] z-[70] flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_60px_hsl(var(--foreground)/0.18)] sm:inset-x-auto sm:bottom-5 sm:top-auto sm:h-[min(40rem,calc(100dvh-7rem))] sm:w-[25rem]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex min-w-0 items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4 w-4" /></div><div className="min-w-0"><h2 className="truncate text-sm font-semibold">AI Farm Assistant</h2><p className="text-[10px] text-muted-foreground">{farm.length ? `${Math.min(farm.length, 8)} KPI terakhir aktif` : 'Tanpa data KPI tersimpan'}</p></div></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" onClick={startNew} disabled={isStreaming} className="h-8 w-8" aria-label="Percakapan baru"><AapmIcon name="solar:pen-new-square-bold" className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8" aria-label="Tutup AI Assistant"><AapmIcon name="solar:close-circle-bold" className="h-4 w-4" /></Button></div></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4"><div className="flex min-h-full flex-col gap-4">{messages.length === 0 ? <div className="my-auto"><p className="text-sm font-semibold">Tanya cepat dari halaman ini.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Gunakan percakapan penuh untuk analisis panjang, lalu kembali ke pekerjaan Anda tanpa kehilangan konteks.</p><div className="mt-4 grid grid-cols-3 gap-2">{quickRoutes.map((item) => <button key={item.to} type="button" onClick={() => { setOpen(false); navigate(item.to); }} className="rounded-lg border border-border px-2 py-2 text-center text-[10px] text-muted-foreground transition-colors hover:bg-surface-subtle"><AapmIcon name={item.icon} className="mx-auto mb-1 h-4 w-4 text-brand-orange" />{item.label}</button>)}</div></div> : messages.map((message) => message.role === 'user' ? <div key={message.id} className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-brand-green px-3 py-2 text-xs leading-5 text-white">{message.content}</div> : <div key={message.id} className="max-w-full text-xs leading-5"><div className="mb-1 flex items-center gap-2 font-semibold"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-3.5 w-3.5 text-brand-orange" /> AI Farm Assistant</div>{message.streaming && !message.content && <BubbleThinking label={streamStatus} />}{message.content && <BubbleAnswer content={message.content} />}{message.fallback && <p className="mt-2 text-[10px] text-brand-orange">{message.notice || 'Menggunakan respons lokal aman.'}</p>}{message.error && <p className="mt-2 text-[10px] text-danger">Permintaan belum dapat diproses.</p>}{!message.streaming && message.provider && <p className="mt-2 text-[10px] text-muted-foreground">{message.fallback ? 'Respons lokal aman' : `OpenRouter · ${message.model}`}</p>}</div>)}<div ref={endRef} /></div></div>
      <footer className="shrink-0 border-t border-border p-3"><div className="flex items-end gap-2 rounded-xl border border-input bg-surface-elevated p-1.5 focus-within:border-brand-green"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} placeholder="Tanyakan kondisi farm…" className="max-h-24 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-xs leading-5 outline-none" /><Button type="button" size="icon" onClick={send} disabled={!input.trim() || isStreaming} className="h-8 w-8 shrink-0 rounded-lg bg-brand-orange text-white hover:bg-brand-orange/90"><AapmIcon name="solar:plane-2-bold-duotone" className="h-3.5 w-3.5" /><span className="sr-only">Kirim</span></Button></div><Link to="/ai-assistant" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-orange hover:text-brand-orange/75">Buka workspace AI penuh <AapmIcon name="solar:arrow-right-up-bold" className="h-3 w-3" /></Link></footer>
    </section>}
    {!open && <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[65] inline-flex h-11 items-center gap-2 rounded-full bg-brand-orange px-4 text-sm font-semibold text-white shadow-[0_12px_28px_hsl(var(--aapm-orange-500)/0.32)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-3.5 w-3.5" /></span><span className="hidden sm:inline">Tanya AI</span></button>}
  </>;
}
