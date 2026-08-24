import React, { useState, useRef, useEffect } from 'react';
import AapmIcon from '@/components/icons/AapmIcon';
import ContentContainer from '@/components/layout/ContentContainer';
import { Button, ScrollArea, Switch } from '@/components/primitives';
import { useAiAssistant, useFarmData } from '@/lib/useCourseData';

const welcomeMessage = 'Halo! Saya AI Layer Farm Assistant. Saya bisa membantu menganalisis data produksi, menghitung KPI, mengidentifikasi kemungkinan penyebab masalah, dan membuat farm improvement plan. Untuk pertanyaan diagnosis penyakit atau dosis obat, saya akan selalu menyarankan konsultasi dokter hewan. Apa yang bisa saya bantu?';

const suggestions = [
  'HDP farm saya turun dari 92% ke 85% dalam seminggu. Apa yang harus saya cek?',
  'Jelaskan hubungan Feed Intake → Egg Production → FCR → Profit.',
  'Bagaimana cara menghitung dan meningkatkan uniformity flock?',
  'Konsumsi air naik drastis hari ini, kemungkinan penyebabnya apa?',
  'Buatkan checklist biosecurity harian untuk closed house layer.',
];

export default function AiAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [includeFarm, setIncludeFarm] = useState(true);
  const scrollRef = useRef(null);
  const ai = useAiAssistant();
  const { data: farm = [] } = useFarmData();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input;
    if (!msg.trim() || ai.isPending) return;
    const farmContext = includeFarm && farm.length > 0 ? farm.slice(-8) : null;
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setInput('');
    try {
      const res = await ai.mutateAsync({ message: msg, farmContext });
      setMessages(m => [...m, { role: 'assistant', content: res.reply || res.error || 'Maaf, terjadi kesalahan.' }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Maaf, terjadi kesalahan koneksi. Coba lagi.' }]);
    }
  };

  const resetConversation = () => {
    if (ai.isPending) return;
    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setInput('');
  };

  return (
    <ContentContainer className="flex h-full max-w-[1440px] flex-col py-4 sm:py-6 lg:py-8">
      <section className="flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--surface-shadow)]">
        <header className="flex shrink-0 flex-col gap-4 border-b border-border bg-surface-default px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm">
              <AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-base font-semibold tracking-[-0.02em] sm:text-lg">AI Layer Farm Assistant</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-tint-green px-2 py-0.5 text-[10px] font-semibold text-tint-green-foreground"><span className="h-1.5 w-1.5 rounded-full bg-brand-green" /> Siap membantu</span></div>
              <p className="mt-0.5 text-xs text-muted-foreground">Ruang kerja untuk membaca data dan menyusun keputusan farm.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetConversation} disabled={ai.isPending} className="w-full sm:w-auto"><AapmIcon name="add" /> Percakapan baru</Button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="flex min-h-0 min-w-0 flex-col">
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
                {messages.map((message, index) => {
                  const isUser = message.role === 'user';
                  return (
                    <div key={`${message.role}-${index}`} className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
                      {!isUser && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white shadow-sm"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4 w-4" /></div>}
                      <div className={`max-w-[min(42rem,84%)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${isUser ? 'rounded-tr-md bg-brand-green text-white' : 'rounded-tl-md border border-border bg-surface-subtle text-foreground'}`}>
                        {message.content}
                      </div>
                      {isUser && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-blue text-tint-blue-foreground"><AapmIcon name="solar:user-rounded-bold" className="h-4 w-4" /></div>}
                    </div>
                  );
                })}

                {ai.isPending && <div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white shadow-sm"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4 w-4" /></div><div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-surface-subtle px-4 py-3 text-sm text-muted-foreground"><AapmIcon name="loading" className="h-4 w-4 animate-spin text-brand-orange" /> Menganalisis konteks farm…</div></div>}

                {messages.length <= 1 && !ai.isPending && <div className="pt-2"><div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mulai dari pertanyaan ini</div><div className="grid gap-2 sm:grid-cols-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)} className="rounded-xl border border-border bg-surface-default px-3 py-3 text-left text-xs leading-5 text-muted-foreground transition-colors hover:border-brand-orange/45 hover:bg-tint-orange hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{suggestion}<AapmIcon name="arrowRight" className="ml-1.5 inline h-3.5 w-3.5 text-brand-orange" /></button>)}</div></div>}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="sticky bottom-0 shrink-0 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:px-6">
              <div className="mx-auto max-w-3xl">
                <label className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2 text-xs lg:hidden"><span className="inline-flex items-center gap-2 text-muted-foreground"><AapmIcon name="analytics" className="h-4 w-4 text-brand-orange" /> Sertakan data KPI sebagai konteks</span><Switch checked={includeFarm} onCheckedChange={setIncludeFarm} aria-label="Sertakan data KPI Dashboard sebagai konteks" /></label>
                <div className="aapm-field flex items-end gap-2 rounded-2xl border border-input bg-surface-elevated p-2 shadow-sm">
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} placeholder="Tanyakan apa saja tentang layer farm management…" className="max-h-32 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground" />
                  <Button type="button" size="icon" onClick={() => send()} disabled={ai.isPending || !input.trim()} className="h-10 w-10 shrink-0 rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90"><AapmIcon name="solar:plane-2-bold-duotone" className="h-4 w-4" /><span className="sr-only">Kirim pertanyaan</span></Button>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground"><AapmIcon name="solar:medical-kit-bold" className="h-3.5 w-3.5 shrink-0 text-brand-orange" /> Untuk diagnosis penyakit dan dosis obat, selalu konsultasikan dengan dokter hewan.</div>
              </div>
            </div>
          </section>

          <aside className="hidden min-h-0 flex-col border-l border-border bg-surface-subtle/70 lg:flex">
            <div className="border-b border-border p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold">Farm context</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Gunakan delapan input KPI terakhir agar jawaban lebih relevan.</p></div><Switch checked={includeFarm} onCheckedChange={setIncludeFarm} aria-label="Sertakan data KPI Dashboard sebagai konteks" /></div><div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${includeFarm ? 'border-tint-green-border bg-tint-green text-tint-green-foreground' : 'border-border bg-surface-default text-muted-foreground'}`}><span className="font-semibold">{includeFarm ? 'Konteks aktif' : 'Konteks nonaktif'}</span><span className="mt-0.5 block opacity-80">{includeFarm ? `${farm.length ? Math.min(farm.length, 8) : 0} input KPI akan dibaca.` : 'AI menjawab tanpa data dashboard.'}</span></div></div>
            <div className="flex-1 p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bisa dibantu</div><ul className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground"><li className="flex gap-2"><AapmIcon name="analytics" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Baca perubahan HDP, FCR, konsumsi pakan, dan berat telur.</li><li className="flex gap-2"><AapmIcon name="course" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Hubungkan masalah farm ke materi belajar yang relevan.</li><li className="flex gap-2"><AapmIcon name="checkRead" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Susun checklist tindakan dan pertanyaan lanjutan.</li></ul></div>
            <div className="border-t border-border p-5"><div className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><AapmIcon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" /> AI membantu analisis operasional, bukan pengganti diagnosis medis veteriner.</div></div>
          </aside>
        </div>
      </section>
    </ContentContainer>
  );
}
