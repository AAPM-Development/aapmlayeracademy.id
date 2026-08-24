import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import AapmIcon from '@/components/icons/AapmIcon';
import AiAvatar from '@/components/ai/AiAvatar';
import { Button, ScrollArea, Switch } from '@/components/primitives';
import { useAuth } from '@/lib/AuthContext';
import { useFarmData, useUserProgress } from '@/lib/useCourseData';
import { useAiChat } from '@/components/ai/AiChatProvider';

const welcomeMessage = 'Bawa situasi yang Anda lihat di farm. Saya bantu mengurai sinyal, menyusun urutan pemeriksaan, lalu merumuskan langkah berikutnya.';

const workspaceTools = [
  { to: '/kpi', label: 'Farm KPI', icon: 'solar:chart-square-bold-duotone' },
  { to: '/calculators', label: 'Kalkulator', icon: 'solar:calculator-bold-duotone' },
  { to: '/modules', label: 'Materi', icon: 'solar:notebook-bold-duotone' },
];

function personalizedSuggestions({ farm, progress, user }) {
  const name = (user?.fullName || user?.full_name || user?.email || 'saya').split(' ')[0];
  const latest = farm.at(-1);
  const previous = farm.at(-2);
  const completed = progress.filter((item) => item.completed).length;

  if (!latest) return [
    `${name}, saya belum punya data KPI farm. Bantu saya menentukan lima data baseline yang perlu dicatat minggu ini.`,
    'Buatkan format catatan harian sederhana untuk HDP, pakan, air, mortalitas, dan berat telur.',
    completed ? `Saya sudah menyelesaikan ${completed} modul. Topik operasional apa yang paling tepat saya lanjutkan?` : 'Saya baru mulai belajar. Urutkan fokus pertama yang paling penting untuk memahami performa layer farm.',
    'Buatkan checklist biosecurity harian yang praktis untuk closed house layer.',
  ];

  const hdp = Number(latest.henDayProduction);
  const previousHdp = Number(previous?.henDayProduction);
  const hdpPrompt = Number.isFinite(hdp)
    ? `HDP minggu ${latest.week} tercatat ${hdp}%${Number.isFinite(previousHdp) ? `, dari ${previousHdp}% minggu sebelumnya` : ''}. Bantu saya menentukan pemeriksaan prioritas.`
    : `Bantu saya membaca data operasional minggu ${latest.week} dan menentukan sinyal yang perlu diperiksa lebih dulu.`;
  const waterPrompt = Number.isFinite(Number(latest.waterIntake))
    ? `Konsumsi air minggu ${latest.week} adalah ${latest.waterIntake}. Faktor apa yang perlu saya bandingkan sebelum menyimpulkan penyebabnya?`
    : 'Data air belum lengkap. Buatkan cara mencatat konsumsi air yang dapat dibandingkan dengan suhu dan feed intake.';
  const fcrPrompt = Number.isFinite(Number(latest.fcr))
    ? `FCR terakhir saya ${latest.fcr}. Jelaskan data pendamping apa yang perlu dibaca agar evaluasinya tidak keliru.`
    : 'Buatkan urutan analisis hubungan feed intake, egg mass, dan FCR untuk data farm saya.';
  return [hdpPrompt, waterPrompt, fcrPrompt, completed ? `Dengan ${completed} modul selesai, materi mana yang relevan untuk mendukung evaluasi KPI saya saat ini?` : 'Hubungkan evaluasi KPI awal saya dengan jalur belajar Academy yang paling relevan.'];
}

function MarkdownAnswer({ content }) {
  return <ReactMarkdown components={{
    h1: ({ children }) => <h2 className="mt-5 text-base font-semibold tracking-[-0.02em] first:mt-0">{children}</h2>,
    h2: ({ children }) => <h3 className="mt-5 text-sm font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="mt-4 text-sm font-semibold first:mt-0">{children}</h4>,
    p: ({ children }) => <p className="mt-3 first:mt-0">{children}</p>,
    ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-brand-orange">{children}</ul>,
    ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-brand-orange">{children}</ol>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    blockquote: ({ children }) => <blockquote className="mt-4 border-l-2 border-brand-orange pl-3 text-muted-foreground">{children}</blockquote>,
  }}>{content}</ReactMarkdown>;
}

function ThinkingIndicator({ label }) {
  return <div className="aapm-ai-thinking" aria-live="polite"><AiAvatar size="xs" active decorative /><div className="min-w-0"><p className="text-xs font-semibold text-foreground">{label || 'Menyusun jawaban'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Respons muncul bertahap.</p></div></div>;
}

function AssistantMessage({ message, retryPrompt, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = !message.streaming && message.content.length > 1150;
  return <div className="flex items-start gap-3 sm:gap-4"><AiAvatar size="sm" active={message.streaming} decorative /><div className="min-w-0 max-w-2xl flex-1 pt-0.5"><div className="mb-2 flex items-center gap-2"><span className="text-sm font-semibold tracking-[-0.015em]">AI Layer Farm Assistant</span>{message.streaming && <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-brand-orange"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" /> Live</span>}</div>{message.streaming && !message.content && <ThinkingIndicator label={message.streamStatus} />}{message.content && <><div className={`relative text-sm leading-6 text-foreground ${canCollapse && !expanded ? 'max-h-56 overflow-hidden' : ''}`}><MarkdownAnswer content={message.content} />{canCollapse && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />}</div>{canCollapse && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 text-xs font-semibold text-brand-orange transition-colors hover:text-brand-orange/75">{expanded ? 'Ringkas jawaban' : 'Tampilkan jawaban lengkap'}</button>}</>}{message.fallback && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-tint-orange-border bg-tint-orange px-2.5 py-2 text-[11px] leading-4 text-tint-orange-foreground"><AapmIcon name="solar:info-circle-bold" className="h-3.5 w-3.5 shrink-0" /><span>{message.notice || 'Provider belum tersedia pada permintaan ini; respons lokal tetap tersimpan.'}</span>{retryPrompt && <button type="button" onClick={() => onRetry(retryPrompt)} className="font-semibold text-brand-orange underline underline-offset-2">Coba provider lagi</button>}</div>}{message.error && <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/20 bg-danger/10 px-2.5 py-2 text-[11px] leading-4 text-danger"><AapmIcon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />Permintaan tidak dapat diproses. Coba kirim ulang beberapa saat lagi.</div>}{!message.streaming && message.provider && <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground"><AapmIcon name={message.fallback ? 'solar:info-circle-bold' : 'solar:verified-check-bold'} className={`h-3.5 w-3.5 ${message.fallback ? 'text-brand-orange' : 'text-brand-green'}`} /><span>{message.fallback ? 'Respons lokal tersimpan' : `${message.provider === 'openrouter' ? 'OpenRouter' : message.provider} · ${message.model}`}</span></div>}</div></div>;
}

function ConversationList({ conversations, activeConversationId, loading, disabled, onSelect, onDelete, onNew }) {
  return <aside className="hidden w-72 shrink-0 border-r border-border bg-surface-subtle/35 lg:flex lg:flex-col"><div className="flex items-center justify-between px-4 py-4"><div><p className="text-xs font-semibold">Percakapan</p><p className="mt-0.5 text-[10px] text-muted-foreground">Tersimpan di akun Anda</p></div><Button type="button" variant="ghost" size="icon" onClick={onNew} disabled={disabled} className="h-8 w-8" aria-label="Percakapan baru"><AapmIcon name="solar:pen-new-square-bold" className="h-4 w-4 text-brand-orange" /></Button></div><ScrollArea className="min-h-0 flex-1 px-2 pb-3"><div className="space-y-1">{loading && <p className="px-2 py-3 text-xs text-muted-foreground">Memuat percakapan…</p>}{!loading && conversations.length === 0 && <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">Belum ada riwayat. Percakapan pertama akan tersimpan otomatis.</p>}{conversations.map((conversation) => <div key={conversation.id} className={`group flex items-center gap-1 rounded-lg ${conversation.id === activeConversationId ? 'bg-tint-orange' : 'hover:bg-surface-default'}`}><button type="button" onClick={() => onSelect(conversation.id)} disabled={disabled} className="min-w-0 flex-1 px-2.5 py-2.5 text-left"><span className="block truncate text-xs font-medium text-foreground">{conversation.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{conversation.lastMessagePreview || 'Belum ada pesan'}</span></button><Button type="button" variant="ghost" size="icon" onClick={() => onDelete(conversation.id)} disabled={disabled} className="mr-1 h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Hapus percakapan ${conversation.title}`}><AapmIcon name="solar:trash-bin-trash-bold" className="h-3.5 w-3.5 text-muted-foreground hover:text-danger" /></Button></div>)}</div></ScrollArea><div className="border-t border-border p-3"><p className="mb-2 px-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">ALAT CEPAT</p><div className="space-y-1">{workspaceTools.map((tool) => <Link key={tool.to} to={tool.to} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-default hover:text-foreground"><AapmIcon name={tool.icon} className="h-4 w-4 text-brand-orange" /><span>{tool.label}</span></Link>)}</div></div></aside>;
}

export default function AiAssistant() {
  const [input, setInput] = useState('');
  const [includeFarm, setIncludeFarm] = useState(true);
  const scrollRef = useRef(null);
  const { data: farm = [] } = useFarmData();
  const { data: progress = [] } = useUserProgress();
  const { user } = useAuth();
  const { conversations, conversationsLoading, activeConversationId, messages, isLoadingConversation, isStreaming, streamStatus, selectConversation, startNewConversation, deleteConversation, send } = useAiChat();
  const suggestions = useMemo(() => personalizedSuggestions({ farm, progress, user }), [farm, progress, user]);
  const contextLabel = includeFarm ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI aktif` : 'Tanpa konteks KPI';

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, isStreaming]);

  const submit = async (text = input) => {
    const message = text.trim();
    if (!message || isStreaming) return;
    setInput('');
    await send(message, { includeFarm });
  };

  return <div className="flex h-[calc(100dvh-73px)] min-h-[33rem] overflow-hidden bg-background"><ConversationList conversations={conversations} activeConversationId={activeConversationId} loading={conversationsLoading} disabled={isStreaming} onSelect={selectConversation} onDelete={deleteConversation} onNew={startNewConversation} /><section className="flex min-w-0 flex-1 flex-col"><header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-2.5"><AiAvatar size="sm" active={isStreaming} decorative /><div className="min-w-0"><h1 className="truncate text-sm font-semibold tracking-[-0.015em]">AI Layer Farm Assistant</h1><p className="hidden text-[11px] text-muted-foreground sm:block">Riwayat analisis tersimpan khusus di akun Anda.</p></div></div><div className="flex items-center gap-1.5"><select value={activeConversationId ?? ''} onChange={(event) => event.target.value ? selectConversation(Number(event.target.value)) : startNewConversation()} disabled={isStreaming} className="h-8 max-w-36 rounded-lg border border-input bg-background px-2 text-[11px] text-foreground lg:hidden"><option value="">Percakapan baru</option>{conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}</select><span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${includeFarm ? 'bg-tint-green text-tint-green-foreground' : 'bg-surface-subtle text-muted-foreground'}`}><span className={`h-1.5 w-1.5 rounded-full ${includeFarm ? 'bg-brand-green' : 'bg-muted-foreground/50'}`} />{contextLabel}</span><Button type="button" variant="ghost" size="sm" onClick={startNewConversation} disabled={isStreaming} className="h-8 px-2.5 text-xs"><AapmIcon name="solar:pen-new-square-bold" className="h-3.5 w-3.5" /> Baru</Button></div></header><div className="min-h-0 flex-1"><ScrollArea className="h-full"><div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-7 sm:px-8 sm:py-9">{isLoadingConversation ? <p className="text-sm text-muted-foreground">Memuat percakapan…</p> : messages.length === 0 ? <div className="py-3 sm:py-8"><div className="flex items-start gap-3"><AiAvatar size="lg" active decorative /><div><h2 className="text-base font-semibold tracking-[-0.02em]">Mari mulai dari situasi di farm.</h2><p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{welcomeMessage}</p></div></div><div className="mt-8 grid gap-2 sm:grid-cols-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => submit(suggestion)} className="group rounded-xl border border-border bg-surface-default px-3 py-3 text-left text-xs leading-5 text-muted-foreground transition-colors hover:border-brand-orange/35 hover:bg-tint-orange hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex gap-2"><AapmIcon name="solar:arrow-right-up-bold" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />{suggestion}</span></button>)}</div></div> : <div className="flex flex-col gap-7 sm:gap-9">{messages.map((message, index) => message.role === 'user' ? <div key={message.id} className="flex justify-end"><div className="max-w-[88%] rounded-2xl rounded-br-md bg-brand-green px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm">{message.content}</div></div> : <AssistantMessage key={message.id} message={{ ...message, streamStatus }} retryPrompt={message.fallback ? messages[index - 1]?.content : ''} onRetry={submit} />)}<div ref={scrollRef} /></div>}</div></ScrollArea></div><div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-8 sm:py-4"><div className="mx-auto max-w-3xl"><div className="aapm-field flex items-end gap-2 rounded-2xl border border-input bg-surface-elevated p-2 shadow-sm transition-shadow focus-within:shadow-md"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={1} placeholder="Tanyakan situasi yang sedang terjadi di farm…" className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground" /><Button type="button" size="icon" onClick={() => submit()} disabled={isStreaming || !input.trim()} className="h-9 w-9 shrink-0 rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90"><AapmIcon name="solar:plane-2-bold-duotone" className="h-4 w-4" /><span className="sr-only">Kirim pertanyaan</span></Button></div><div className="mt-2 flex items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground"><AapmIcon name="solar:medical-kit-bold" className="h-3.5 w-3.5 shrink-0 text-brand-orange" /> Untuk diagnosis penyakit dan dosis obat, konsultasikan dengan dokter hewan.</p><div className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground lg:hidden"><Switch checked={includeFarm} onCheckedChange={setIncludeFarm} aria-label="Sertakan data KPI sebagai konteks" className="scale-75" />KPI</div></div></div></div></section><aside className="hidden w-72 shrink-0 border-l border-border bg-surface-subtle/45 2xl:flex 2xl:flex-col"><div className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold">Konteks farm</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Gunakan hingga delapan catatan KPI terakhir.</p></div><Switch checked={includeFarm} onCheckedChange={setIncludeFarm} aria-label="Sertakan data KPI Dashboard sebagai konteks" /></div><div className={`mt-4 rounded-lg px-3 py-2.5 text-[11px] leading-5 ${includeFarm ? 'bg-tint-green text-tint-green-foreground' : 'bg-surface-default text-muted-foreground'}`}><span className="block font-semibold">{includeFarm ? 'Konteks aktif' : 'Konteks nonaktif'}</span><span className="opacity-80">{includeFarm ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI akan dibaca.` : 'Jawaban tidak memakai data Dashboard.'}</span></div></div><div className="mt-auto border-t border-border p-5"><div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">CAKUPAN ANALISIS</div><ul className="mt-3 space-y-3 text-[11px] leading-5 text-muted-foreground"><li className="flex gap-2"><AapmIcon name="solar:chart-square-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />Sinyal HDP, FCR, pakan, air, dan berat telur.</li><li className="flex gap-2"><AapmIcon name="solar:clipboard-check-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />Urutan tindakan dan checklist lapangan.</li><li className="flex gap-2"><AapmIcon name="solar:shield-check-bold" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />Bukan pengganti diagnosis medis veteriner.</li></ul></div></aside></div>;
}
