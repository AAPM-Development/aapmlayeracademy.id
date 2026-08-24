import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import AapmIcon from '@/components/icons/AapmIcon';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, ScrollArea, Switch } from '@/components/primitives';
import { nativeApi } from '@/api/nativeClient';
import { useAuth } from '@/lib/AuthContext';
import { useFarmData, useUserProgress } from '@/lib/useCourseData';

const welcomeMessage = 'Bawa situasi yang Anda lihat di farm. Saya bantu mengurai sinyal, menyusun urutan pemeriksaan, lalu merumuskan langkah berikutnya.';

function makeDeliberation(message, farmCount, includeFarm) {
  const lower = message.toLowerCase();
  const focus = lower.includes('hdp') || lower.includes('produksi')
    ? 'Memprioritaskan sinyal produksi, pakan, air, lingkungan, dan kesehatan flock.'
    : lower.includes('air')
      ? 'Membandingkan perubahan konsumsi air dengan lingkungan, pakan, dan kondisi jalur minum.'
      : lower.includes('fcr') || lower.includes('pakan')
        ? 'Membaca hubungan intake, egg mass, kehilangan pakan, dan kondisi kandang.'
        : 'Memetakan situasi ke pemeriksaan operasional yang paling relevan.';

  return [
    { label: 'Memahami situasi', detail: 'Pertanyaan dan periode perubahan dibaca sebagai dasar analisis.' },
    { label: includeFarm ? 'Membaca konteks KPI' : 'Menjaga analisis netral', detail: includeFarm ? `${farmCount} catatan KPI terbaru disertakan bila tersedia.` : 'Jawaban tidak memakai data Dashboard.' },
    { label: 'Menyusun prioritas', detail: focus },
  ];
}

function personalizedSuggestions({ farm, progress, user }) {
  const name = (user?.fullName || user?.full_name || user?.email || 'saya').split(' ')[0];
  const latest = farm.at(-1);
  const previous = farm.at(-2);
  const completed = progress.filter((item) => item.completed).length;

  if (!latest) {
    return [
      `${name}, saya belum punya data KPI farm. Bantu saya menentukan lima data baseline yang perlu dicatat minggu ini.`,
      `Buatkan format catatan harian sederhana untuk HDP, pakan, air, mortalitas, dan berat telur.`,
      completed ? `Saya sudah menyelesaikan ${completed} modul. Topik operasional apa yang paling tepat saya lanjutkan?` : 'Saya baru mulai belajar. Urutkan fokus pertama yang paling penting untuk memahami performa layer farm.',
      'Buatkan checklist biosecurity harian yang praktis untuk closed house layer.',
    ];
  }

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

function ThinkingIndicator({ label }) {
  return (
    <div className="aapm-ai-thinking" aria-live="polite">
      <span className="aapm-ai-orbit" aria-hidden="true"><span /><span /><span /></span>
      <div className="min-w-0"><p className="text-xs font-semibold text-foreground">{label || 'Menyusun jawaban'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Jawaban akan tampil bertahap.</p></div>
    </div>
  );
}

function DeliberationPanel({ id, steps, streaming, label }) {
  if (streaming) return <ThinkingIndicator label={label || steps?.[0]?.label || 'Membaca konteks farm'} />;
  return (
    <Accordion type="single" collapsible className="mt-3 w-full max-w-2xl rounded-xl border border-border/80 bg-surface-subtle/70 px-3">
      <AccordionItem value={`consideration-${id}`} className="border-0">
        <AccordionTrigger className="py-2.5 text-[11px] font-medium text-muted-foreground hover:no-underline">
          <span className="flex items-center gap-2"><AapmIcon name="solar:eye-closed-bold" className="h-3.5 w-3.5 text-brand-orange" /> Pertimbangan jawaban</span>
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <ol className="space-y-2 pt-0.5">
            {steps?.map((step, index) => <li key={step.label} className="flex gap-2.5 text-[11px] leading-5 text-muted-foreground"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-tint-orange font-semibold text-[9px] text-brand-orange">{index + 1}</span><span><strong className="font-medium text-foreground">{step.label}.</strong> {step.detail}</span></li>)}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
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

function AssistantMessage({ message }) {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = !message.streaming && message.content.length > 1150;
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4 w-4" /></div>
      <div className="min-w-0 max-w-2xl flex-1 pt-0.5">
        <div className="mb-2 flex items-center gap-2"><span className="text-sm font-semibold tracking-[-0.015em]">AI Layer Farm Assistant</span>{message.streaming && <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-brand-orange"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" /> Live</span>}</div>
        {!message.content && <DeliberationPanel id={message.id} steps={message.deliberation} streaming={message.streaming} label={message.streamStatus} />}
        {message.content && <>
          <div className={`relative text-sm leading-6 text-foreground ${canCollapse && !expanded ? 'max-h-56 overflow-hidden' : ''}`}>
            <MarkdownAnswer content={message.content} />
            {canCollapse && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />}
          </div>
          {canCollapse && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 text-xs font-semibold text-brand-orange transition-colors hover:text-brand-orange/75">{expanded ? 'Ringkas jawaban' : 'Tampilkan jawaban lengkap'}</button>}
          <DeliberationPanel id={message.id} steps={message.deliberation} streaming={false} />
        </>}
        {message.fallback && <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-tint-orange-border bg-tint-orange px-2.5 py-2 text-[11px] leading-4 text-tint-orange-foreground"><AapmIcon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{message.notice}</div>}
        {message.error && <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/20 bg-danger/10 px-2.5 py-2 text-[11px] leading-4 text-danger"><AapmIcon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />Permintaan tidak dapat diproses. Coba kirim ulang beberapa saat lagi.</div>}
        {!message.streaming && message.provider && <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground"><AapmIcon name={message.fallback ? 'solar:info-circle-bold' : 'solar:verified-check-bold'} className={`h-3.5 w-3.5 ${message.fallback ? 'text-brand-orange' : 'text-brand-green'}`} /><span>{message.fallback ? 'Respons lokal aman' : `${message.providerLabel || message.provider} · ${message.model}`}</span></div>}
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [includeFarm, setIncludeFarm] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef(null);
  const { data: farm = [] } = useFarmData();
  const { data: progress = [] } = useUserProgress();
  const { user } = useAuth();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  const contextLabel = useMemo(() => includeFarm ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI aktif` : 'Tanpa konteks KPI', [farm.length, includeFarm]);
  const suggestions = useMemo(() => personalizedSuggestions({ farm, progress, user }), [farm, progress, user]);

  const send = async (text) => {
    const message = (text || input).trim();
    if (!message || isStreaming) return;
    const farmContext = includeFarm && farm.length > 0 ? farm.slice(-8) : null;
    const assistantId = `ai-${Date.now()}`;
    const deliberation = makeDeliberation(message, farmContext?.length || 0, includeFarm);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: message }, { id: assistantId, role: 'assistant', content: '', streaming: true, deliberation }]);
    setInput('');
    setIsStreaming(true);

    const updateAssistant = (update) => setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, ...update } : item));
    try {
      await nativeApi.ai.stream({
        message,
        farmContext,
        onEvent: ({ event, data }) => {
          if (event === 'status' && data.label) updateAssistant({ streamStatus: data.label });
          if (event === 'delta' && data.text) setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: `${item.content}${data.text}` } : item));
          if (event === 'notice') updateAssistant({ notice: data.text || '', fallback: true });
          if (event === 'done') updateAssistant({ streaming: false, provider: data.provider, model: data.model, providerLabel: data.provider === 'openrouter' ? 'OpenRouter' : data.provider, fallback: Boolean(data.fallback) });
        },
      });
      updateAssistant({ streaming: false });
    } catch (exception) {
      updateAssistant({ streaming: false, content: exception?.message || 'Koneksi ke asisten belum tersedia. Coba lagi dalam beberapa saat.', error: true });
    } finally {
      setIsStreaming(false);
    }
  };

  const resetConversation = () => {
    if (isStreaming) return;
    setMessages([]);
    setInput('');
  };

  return (
    <div className="flex h-[calc(100dvh-73px)] min-h-[33rem] overflow-hidden bg-background">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4 w-4" /></div><div className="min-w-0"><h1 className="truncate text-sm font-semibold tracking-[-0.015em]">AI Layer Farm Assistant</h1><p className="hidden text-[11px] text-muted-foreground sm:block">Analisis operasional untuk keputusan lapangan.</p></div></div>
          <div className="flex items-center gap-1.5"><span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${includeFarm ? 'bg-tint-green text-tint-green-foreground' : 'bg-surface-subtle text-muted-foreground'}`}><span className={`h-1.5 w-1.5 rounded-full ${includeFarm ? 'bg-brand-green' : 'bg-muted-foreground/50'}`} />{contextLabel}</span><Button type="button" variant="ghost" size="sm" onClick={resetConversation} disabled={isStreaming} className="h-8 px-2.5 text-xs"><AapmIcon name="solar:pen-new-square-bold" className="h-3.5 w-3.5" /> Baru</Button></div>
        </header>

        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-7 sm:px-8 sm:py-9">
              {messages.length === 0 ? <div className="py-3 sm:py-8"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4.5 w-4.5" /></div><div><h2 className="text-base font-semibold tracking-[-0.02em]">Mari mulai dari situasi di farm.</h2><p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{welcomeMessage}</p></div></div><div className="mt-8 grid gap-2 sm:grid-cols-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)} className="group rounded-xl border border-border bg-surface-default px-3 py-3 text-left text-xs leading-5 text-muted-foreground transition-colors hover:border-brand-orange/35 hover:bg-tint-orange hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex gap-2"><AapmIcon name="solar:arrow-right-up-bold" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />{suggestion}</span></button>)}</div></div> : <div className="flex flex-col gap-7 sm:gap-9">{messages.map((message) => message.role === 'user' ? <div key={message.id} className="flex justify-end"><div className="max-w-[88%] rounded-2xl rounded-br-md bg-brand-green px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm">{message.content}</div></div> : <AssistantMessage key={message.id} message={message} />)}<div ref={scrollRef} /></div>}
            </div>
          </ScrollArea>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-8 sm:py-4">
          <div className="mx-auto max-w-3xl"><div className="aapm-field flex items-end gap-2 rounded-2xl border border-input bg-surface-elevated p-2 shadow-sm transition-shadow focus-within:shadow-md"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} placeholder="Tanyakan situasi yang sedang terjadi di farm…" className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground" /><Button type="button" size="icon" onClick={() => send()} disabled={isStreaming || !input.trim()} className="h-9 w-9 shrink-0 rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90"><AapmIcon name="solar:plane-2-bold-duotone" className="h-4 w-4" /><span className="sr-only">Kirim pertanyaan</span></Button></div><p className="mt-2 flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground"><AapmIcon name="solar:medical-kit-bold" className="h-3.5 w-3.5 shrink-0 text-brand-orange" /> Untuk diagnosis penyakit dan dosis obat, konsultasikan dengan dokter hewan.</p></div>
        </div>
      </section>

      <aside className="hidden w-72 shrink-0 border-l border-border bg-surface-subtle/45 lg:flex lg:flex-col">
        <div className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold">Konteks farm</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Gunakan hingga delapan catatan KPI terakhir.</p></div><Switch checked={includeFarm} onCheckedChange={setIncludeFarm} aria-label="Sertakan data KPI Dashboard sebagai konteks" /></div><div className={`mt-4 rounded-lg px-3 py-2.5 text-[11px] leading-5 ${includeFarm ? 'bg-tint-green text-tint-green-foreground' : 'bg-surface-default text-muted-foreground'}`}><span className="block font-semibold">{includeFarm ? 'Konteks aktif' : 'Konteks nonaktif'}</span><span className="opacity-80">{includeFarm ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI akan dibaca.` : 'Jawaban tidak memakai data Dashboard.'}</span></div></div>
        <div className="mt-auto border-t border-border p-5"><div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">CAKUPAN ANALISIS</div><ul className="mt-3 space-y-3 text-[11px] leading-5 text-muted-foreground"><li className="flex gap-2"><AapmIcon name="solar:chart-square-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />Sinyal HDP, FCR, pakan, air, dan berat telur.</li><li className="flex gap-2"><AapmIcon name="solar:clipboard-check-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />Urutan tindakan dan checklist lapangan.</li><li className="flex gap-2"><AapmIcon name="solar:shield-check-bold" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />Bukan pengganti diagnosis medis veteriner.</li></ul></div>
      </aside>
    </div>
  );
}
