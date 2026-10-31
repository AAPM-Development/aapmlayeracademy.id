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
  // The workspace passes the page it was opened from, as a path or a context name.
  if (pathname === "/kpi" || pathname === "kpi") return "kpi";
  if (pathname === "/calculators" || pathname === "calculators") return "calculator";
  if (pathname === "/modules" || pathname === "learning" || pathname.startsWith("/modules/")) {
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

  const hues = ["blue", "green", "teal"];
  return (
    <div className={`stack gap-2 ai-suggest${compact ? " ai-suggest-compact" : ""}`} aria-label="Saran lanjutan APPI">
      <span className="t-overline t-muted">Lanjutkan</span>
      <div className="row wrap gap-2">
        {actions.map((action, index) => (
          <button key={action.label} type="button" className="suggest aapm-ai-quick-action-chip" onClick={() => onSelect(action.prompt)} disabled={disabled}>
            <span className="tile tile-round" data-hue={hues[index % hues.length]}><AapmIcon name={action.icon} /></span>
            <span className="t-clamp-1">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
