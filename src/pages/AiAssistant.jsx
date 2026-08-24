import React, { useEffect, useRef, useState } from 'react';
import AapmIcon from '@/components/icons/AapmIcon';
import { Button, ScrollArea, Switch } from '@/components/primitives';
import { useAiAssistant, useFarmData } from '@/lib/useCourseData';

const welcomeMessage = 'Saya membantu Anda membaca perubahan performa farm, menyusun urutan pemeriksaan, dan menerjemahkan data menjadi tindakan lapangan. Sertakan angka, periode, dan perubahan yang Anda amati.';

const suggestions = [
  'HDP turun dari 92% ke 85% dalam seminggu. Apa yang harus saya cek?',
  'Jelaskan hubungan feed intake, produksi telur, FCR, dan profit.',
  'Buatkan checklist biosecurity harian untuk closed house layer.',
  'Konsumsi air naik drastis hari ini. Apa kemungkinan penyebabnya?',
];

export default function AiAssistant() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: welcomeMessage }]);
  const [input, setInput] = useState('');
  const [includeFarm, setIncludeFarm] = useState(true);
  const scrollRef = useRef(null);
  const ai = useAiAssistant();
  const { data: farm = [] } = useFarmData();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, ai.isPending]);

  const send = async (text) => {
    const message = (text || input).trim();
    if (!message || ai.isPending) return;
    const farmContext = includeFarm && farm.length > 0 ? farm.slice(-8) : null;
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setInput('');
    try {
      const response = await ai.mutateAsync({ message, farmContext });
      setMessages((current) => [...current, { role: 'assistant', content: response.reply || response.error || 'Jawaban belum tersedia. Coba ulangi pertanyaan Anda.' }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Koneksi ke asisten belum tersedia. Coba lagi dalam beberapa saat.' }]);
    }
  };

  const resetConversation = () => {
    if (ai.isPending) return;
    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setInput('');
  };

  const contextLabel = includeFarm
    ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI aktif`
    : 'Tanpa konteks KPI';

  return (
    <div className="flex h-[calc(100dvh-73px)] min-h-[34rem] flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-surface-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 text-xs text-muted-foreground">
          <AapmIcon name="solar:chart-2-bold-duotone" className="h-4 w-4 shrink-0 text-brand-orange" />
          <span className="truncate">Analisis data, susun prioritas, lalu putuskan langkah lapangan.</span>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${includeFarm ? 'bg-tint-green text-tint-green-foreground' : 'bg-surface-subtle text-muted-foreground'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${includeFarm ? 'bg-brand-green' : 'bg-muted-foreground/50'}`} />
            {contextLabel}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={resetConversation} disabled={ai.isPending} className="h-8 px-2.5 text-xs">
            <AapmIcon name="add" className="h-4 w-4" /> Percakapan baru
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 lg:hidden">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><AapmIcon name="analytics" className="h-4 w-4 text-brand-orange" /> Sertakan data KPI</span>
            <Switch checked={includeFarm} onCheckedChange={setIncludeFarm} aria-label="Sertakan data KPI Dashboard sebagai konteks" />
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-7 sm:px-8 sm:py-10">
              <div className="mb-8 flex items-start gap-3 sm:mb-10">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4.5 w-4.5" /></div>
                <div className="pt-0.5"><div className="text-sm font-semibold tracking-[-0.015em]">AI Layer Farm Assistant</div><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{messages[0].content}</p></div>
              </div>

              <div className="flex flex-col gap-6 sm:gap-7">
                {messages.slice(1).map((message, index) => {
                  const isUser = message.role === 'user';
                  return (
                    <div key={`${message.role}-${index}`} className={`flex gap-3 ${isUser ? 'justify-end' : 'items-start'}`}>
                      {!isUser && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange"><AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-4 w-4" /></div>}
                      <div className={`whitespace-pre-wrap text-sm leading-6 ${isUser ? 'max-w-[85%] rounded-2xl rounded-br-md bg-brand-green px-4 py-3 text-white shadow-sm' : 'max-w-2xl pt-0.5 text-foreground'}`}>{message.content}</div>
                    </div>
                  );
                })}

                {ai.isPending && <div className="flex items-center gap-2.5 text-sm text-muted-foreground"><AapmIcon name="loading" className="h-4 w-4 animate-spin text-brand-orange" /> Menganalisis konteks farm…</div>}

                {messages.length === 1 && !ai.isPending && (
                  <div className="border-t border-border pt-5">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mulai dari sini</div>
                    <div className="grid sm:grid-cols-2 sm:gap-x-8">
                      {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)} className="group flex items-start gap-2 border-b border-border py-3 text-left text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><AapmIcon name="arrowRight" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange transition-transform group-hover:translate-x-0.5" />{suggestion}</button>)}
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-8 sm:py-5">
            <div className="mx-auto max-w-4xl">
              <div className="aapm-field flex items-end gap-2 rounded-2xl border border-input bg-surface-elevated p-2 shadow-sm">
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} placeholder="Tanyakan situasi yang sedang terjadi di farm…" className="max-h-32 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground" />
                <Button type="button" size="icon" onClick={() => send()} disabled={ai.isPending || !input.trim()} className="h-10 w-10 shrink-0 rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90"><AapmIcon name="solar:plane-2-bold-duotone" className="h-4 w-4" /><span className="sr-only">Kirim pertanyaan</span></Button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground"><AapmIcon name="solar:medical-kit-bold" className="h-3.5 w-3.5 shrink-0 text-brand-orange" /> Untuk diagnosis penyakit dan dosis obat, konsultasikan dengan dokter hewan.</p>
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col border-l border-border bg-surface-subtle/55 lg:flex">
          <div className="border-b border-border p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold">Konteks farm</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Gunakan hingga delapan catatan KPI terakhir.</p></div><Switch checked={includeFarm} onCheckedChange={setIncludeFarm} aria-label="Sertakan data KPI Dashboard sebagai konteks" /></div><div className={`mt-4 border-l-2 py-1 pl-3 text-xs ${includeFarm ? 'border-brand-green text-tint-green-foreground' : 'border-border text-muted-foreground'}`}><span className="font-semibold">{includeFarm ? 'Konteks aktif' : 'Konteks nonaktif'}</span><span className="mt-0.5 block opacity-80">{includeFarm ? `${farm.length ? Math.min(farm.length, 8) : 0} catatan KPI akan dibaca.` : 'Jawaban tidak memakai data dashboard.'}</span></div></div>
          <div className="flex-1 p-5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dapat dibantu</div><ul className="mt-4 space-y-4 text-xs leading-5 text-muted-foreground"><li className="flex gap-2"><AapmIcon name="analytics" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Baca perubahan HDP, FCR, konsumsi pakan, dan berat telur.</li><li className="flex gap-2"><AapmIcon name="course" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Hubungkan masalah lapangan dengan materi belajar relevan.</li><li className="flex gap-2"><AapmIcon name="checkRead" className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" /> Susun checklist tindakan dan pertanyaan lanjutan.</li></ul></div>
          <div className="border-t border-border p-5"><div className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><AapmIcon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" /> AI membantu analisis operasional, bukan pengganti diagnosis medis veteriner.</div></div>
        </aside>
      </div>
    </div>
  );
}
