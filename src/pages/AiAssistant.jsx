import React, { useState, useRef, useEffect } from 'react';
import AapmIcon from '@/components/icons/AapmIcon';
import { useAiAssistant, useFarmData } from '@/lib/useCourseData';

const suggestions = [
  'HDP farm saya turun dari 92% ke 85% dalam seminggu. Apa yang harus saya cek?',
  'Jelaskan hubungan Feed Intake → Egg Production → FCR → Profit.',
  'Bagaimana cara menghitung dan meningkatkan uniformity flock?',
  'Konsumsi air naik drastis hari ini, kemungkinan penyebabnya apa?',
  'Buatkan checklist biosecurity harian untuk closed house layer.',
];

export default function AiAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Halo! Saya AI Layer Farm Assistant. Saya bisa membantu menganalisis data produksi, menghitung KPI, mengidentifikasi kemungkinan penyebab masalah, dan membuat farm improvement plan. Untuk pertanyaan diagnosis penyakit atau dosis obat, saya akan selalu menyarankan konsultasi dokter hewan. Apa yang bisa saya bantu?' },
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

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 flex flex-col h-[calc(100vh-1px)] lg:h-screen">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange text-white">
          <AapmIcon name="solar:stars-minimalistic-bold-duotone" className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">AI Layer Farm Assistant</h1>
          <p className="text-xs text-muted-foreground">Asisten ahli manajemen peternakan ayam petelur</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={includeFarm} onChange={e => setIncludeFarm(e.target.checked)} className="h-3.5 w-3.5 rounded" />
          Sertakan data KPI Dashboard saya sebagai konteks
        </label>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border bg-card p-4 space-y-4 mb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.role === 'user' ? 'bg-sky-100 text-sky-700' : 'bg-brand-orange text-white'}`}>
              {m.role === 'user' ? <AapmIcon name="solar:user-rounded-bold" className="h-4 w-4" /> : <AapmIcon name="solar:chat-round-dots-bold" className="h-4 w-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${m.role === 'user' ? 'bg-amber-600 text-white' : 'bg-muted/50'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {ai.isPending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white">
              <AapmIcon name="solar:chat-round-dots-bold" className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-2xl px-4 py-2.5">
              <AapmIcon name="loading" className="h-4 w-4 animate-spin" /> Menganalisis…
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => send(s)} className="text-xs rounded-full border bg-card px-3 py-1.5 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2 focus-within:border-amber-400">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Tanyakan apa saja tentang layer farm management…"
          className="flex-1 bg-transparent text-sm outline-none py-1.5"
        />
        <button onClick={() => send()} disabled={ai.isPending || !input.trim()} className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white disabled:opacity-40 hover:bg-amber-700">
          <AapmIcon name="solar:plain-2-bold" className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
        <AapmIcon name="solar:medical-kit-bold" className="h-3 w-3" /> Untuk diagnosis penyakit & dosis obat, selalu konsultasi dokter hewan.
      </div>
    </div>
  );
}
