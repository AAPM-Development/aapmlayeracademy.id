import React from "react";
import AapmIcon from "@/components/icons/AapmIcon";

const actionSets = {
  kpi: [
    {
      label: "Bandingkan dengan minggu lalu",
      icon: "solar:chart-2-bold-duotone",
      prompt:
        "Bandingkan temuan APPI tadi dengan minggu sebelumnya dan jelaskan perubahan yang paling penting.",
    },
    {
      label: "Buat checklist pemeriksaan",
      icon: "solar:clipboard-check-bold-duotone",
      prompt:
        "Ubah jawaban APPI tadi menjadi checklist pemeriksaan lapangan yang berurutan.",
    },
    {
      label: "Data pendamping yang perlu dicek",
      icon: "solar:list-bold",
      prompt:
        "Data pendamping apa yang perlu saya cek sebelum mengambil keputusan dari analisis tadi?",
    },
  ],
  field: [
    {
      label: "Buat checklist lapangan",
      icon: "solar:clipboard-check-bold-duotone",
      prompt:
        "Buat checklist lapangan singkat berdasarkan jawaban APPI tadi, dari pemeriksaan awal sampai tindak lanjut.",
    },
    {
      label: "Apa tanda bahayanya?",
      icon: "solar:shield-check-bold",
      prompt:
        "Apa tanda bahaya yang harus membuat saya segera meminta bantuan dokter hewan atau supervisor farm?",
    },
    {
      label: "Tanya data berikutnya",
      icon: "solar:target-bold-duotone",
      prompt:
        "Pertanyaan lanjutan apa yang paling penting saya jawab agar analisis APPI tadi lebih akurat?",
    },
  ],
  learning: [
    {
      label: "Hubungkan ke modul belajar",
      icon: "solar:notebook-bold-duotone",
      prompt:
        "Hubungkan jawaban APPI tadi ke modul Academy yang paling relevan dan jelaskan alasannya.",
    },
    {
      label: "Buat ringkasan belajar",
      icon: "solar:list-bold",
      prompt:
        "Ringkas jawaban APPI tadi menjadi catatan belajar yang mudah saya tinjau kembali.",
    },
    {
      label: "Uji pemahaman saya",
      icon: "solar:lightbulb-bolt-bold-duotone",
      prompt:
        "Buat tiga pertanyaan kuis singkat dari jawaban APPI tadi, lalu tunggu jawaban saya.",
    },
  ],
  calculator: [
    {
      label: "Jelaskan hasilnya",
      icon: "solar:chart-square-bold-duotone",
      prompt:
        "Jelaskan arti hasil perhitungan tadi dalam bahasa operasional farm yang sederhana.",
    },
    {
      label: "Cek asumsi rumus",
      icon: "solar:clipboard-list-bold-duotone",
      prompt:
        "Periksa asumsi, satuan, dan data apa saja yang harus benar agar perhitungan tadi tidak menyesatkan.",
    },
    {
      label: "Bawa ke keputusan farm",
      icon: "solar:target-bold-duotone",
      prompt:
        "Dari hasil perhitungan tadi, keputusan operasional apa yang layak dipertimbangkan dan apa batasannya?",
    },
  ],
  data: [
    {
      label: "Ringkas temuan utama",
      icon: "solar:list-bold",
      prompt:
        "Ringkas temuan utama dari jawaban APPI tadi menjadi tiga poin yang mudah dipindai.",
    },
    {
      label: "Tunjukkan data yang janggal",
      icon: "solar:target-bold-duotone",
      prompt:
        "Tunjukkan angka atau asumsi yang perlu divalidasi dari analisis tadi sebelum dipakai.",
    },
    {
      label: "Ubah jadi tabel tindakan",
      icon: "solar:clipboard-check-bold-duotone",
      prompt:
        "Ubah analisis tadi menjadi tabel: sinyal, kemungkinan penyebab, data yang perlu dicek, dan tindakan berikutnya.",
    },
  ],
  default: [
    {
      label: "Ringkas jadi langkah",
      icon: "solar:list-bold",
      prompt:
        "Ringkas jawaban APPI tadi menjadi langkah-langkah praktis yang bisa saya lakukan berikutnya.",
    },
    {
      label: "Apa yang perlu saya cek?",
      icon: "solar:target-bold-duotone",
      prompt:
        "Apa yang perlu saya cek atau ukur berikutnya agar jawaban APPI tadi semakin kuat?",
    },
    {
      label: "Buat pertanyaan lanjutan",
      icon: "solar:lightbulb-bolt-bold-duotone",
      prompt:
        "Ajukan satu pertanyaan klarifikasi yang paling penting sebelum kita melanjutkan analisis ini.",
    },
  ],
};

function contextFromPath(pathname = "") {
  if (pathname === "/kpi") return "kpi";
  if (pathname === "/calculators") return "calculator";
  if (pathname === "/modules" || pathname.startsWith("/module/")) {
    return "learning";
  }
  return "";
}

function actionContext({ content = "", pathname = "" }) {
  const source = content.toLocaleLowerCase("id-ID");
  if (/(kpi|hdp|fcr|produksi|telur|pakan|konsumsi air)/.test(source)) {
    return "kpi";
  }
  if (/(biosekuriti|biosecurity|mortalitas|penyakit|gejala|dokter hewan)/.test(source)) {
    return "field";
  }
  if (/(kalkulator|perhitungan|rumus|hitung|persentase|satuan)/.test(source)) {
    return "calculator";
  }
  if (/(modul|materi|belajar|kuis|pelajaran|academy)/.test(source)) {
    return "learning";
  }
  if (/(tabel|data|angka|validasi|baseline|diagram|mermaid)/.test(source)) {
    return "data";
  }
  return contextFromPath(pathname) || "default";
}

export function getAiQuickActions({ content, pathname }) {
  return actionSets[actionContext({ content, pathname })];
}

export default function AiQuickActions({
  content,
  pathname,
  onSelect,
  disabled = false,
  compact = false,
}) {
  if (!content) return null;
  const actions = getAiQuickActions({ content, pathname });

  return (
    <div
      className={`mt-3 min-w-0 max-w-full ${compact ? "text-[11px]" : "text-[11px]"}`}
      aria-label="Saran lanjutan APPI"
    >
      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <AapmIcon
          name="solar:stars-minimalistic-bold-duotone"
          className="h-3 w-3 text-brand-orange"
        />
        Lanjutkan
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onSelect(action.prompt)}
            className="aapm-ai-quick-action-chip group inline-flex min-h-10 min-w-0 max-w-full items-center gap-1.5 px-2.5 py-2 text-left sm:min-h-8 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
          >
            <AapmIcon
              name={action.icon}
              className="h-3.5 w-3.5 shrink-0 text-brand-orange transition-transform group-hover:-translate-y-0.5"
            />
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
