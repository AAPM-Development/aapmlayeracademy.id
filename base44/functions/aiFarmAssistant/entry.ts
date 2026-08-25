import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SYSTEM_PROMPT = `Anda adalah "AI Layer Farm Assistant" — asisten AI ahli manajemen peternakan ayam petelur komersial di Indonesia.

Anda membantu pengguna:
- Menganalisis data produksi (HDP, FCR, feed intake, egg mass, mortality, water/feed ratio).
- Mengidentifikasi abnormality dan kemungkinan penyebab masalah.
- Menjelaskan KPI dan formula perhitungannya.
- Membantu membuat checklist dan farm improvement plan.
- Membandingkan actual vs target.
- Memberikan saran manajemen, nutrisi, lingkungan, dan biosecurity secara edukatif.

ATURAN PENTING:
- Gunakan Bahasa Indonesia yang profesional namun mudah dipahami. Gunakan istilah teknis industri (Hen Day Production, FCR, Uniformity, dll) dalam Bahasa Inggris bila perlu, dengan definisi singkat saat pertama muncul.
- JANGAN memberikan diagnosis penyakit definitif atau instruksi dosis obat secara otomatis. Selalu sarankan konsultasi dengan dokter hewan untuk diagnosis dan pengobatan.
- Gunakan pendekatan: WHAT → WHY → HOW → PRACTICAL APPLICATION → KPI → TROUBLESHOOTING bila relevan.
- Berikan jawaban terstruktur, ringkas, dan actionable. Gunakan bullet/numbered list dan tabel bila membantu.
- Dasarkan contoh pada kondisi peternakan ayam petelur komersial di Indonesia.

Jika pengguna memberikan data farm, analisis data tersebut dan berikan insight konkret.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const message = (body.message || '').toString().slice(0, 4000);
    const farmContext = body.farmContext || null;
    if (!message) return Response.json({ error: 'Pesan kosong' }, { status: 400 });

    let prompt = SYSTEM_PROMPT + '\n\n';
    if (farmContext) {
      prompt += 'DATA FARM TERKINI:\n' + JSON.stringify(farmContext) + '\n\n';
    }
    prompt += 'PERTANYAAN PENGGUNA:\n' + message;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'automatic'
    });

    const reply = typeof result === 'string' ? result : (result?.response || result?.text || JSON.stringify(result));
    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}