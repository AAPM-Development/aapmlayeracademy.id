import { getNextModule } from "@/lib/academyData";

function finite(value) {
  return Number.isFinite(Number(value));
}

function formatValue(value) {
  return finite(value)
    ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
        Number(value),
      )
    : "—";
}

export function personalizedSuggestions({
  farm = [],
  progress = [],
  modules = [],
  user,
  pageContext = "",
}) {
  const displayName = user?.fullName || user?.full_name || "Anda";
  const name = displayName.split(" ")[0] || "Anda";
  const latest = farm.at(-1);
  const previous = farm.at(-2);
  const completed = progress.filter(
    (item) => item?.completed && Number(item.moduleNumber) > 0,
  ).length;
  const nextModule = getNextModule(modules, progress);
  const nextModuleLabel = nextModule
    ? `Modul ${nextModule.moduleNumber}: ${nextModule.title}`
    : "modul Academy yang belum selesai";
  const weekLabel = latest?.week ? `minggu ${latest.week}` : "catatan terbaru";
  const hdp = Number(latest?.henDayProduction);
  const previousHdp = Number(previous?.henDayProduction);
  const hdpDelta = finite(hdp) && finite(previousHdp) ? hdp - previousHdp : null;
  const missingFields = latest
    ? [
        ["feedIntake", "pakan"],
        ["waterIntake", "air"],
        ["eggWeight", "berat telur"],
        ["mortality", "mortalitas"],
        ["temperature", "suhu"],
        ["humidity", "kelembapan"],
        ["fcr", "FCR"],
      ]
        .filter(([key]) => !finite(latest[key]))
        .map(([, label]) => label)
    : [];
  const suggestions = [];
  const add = (id, label, detail, prompt) =>
    suggestions.push({ id, label, detail, prompt });

  if (!latest) {
    add(
      "baseline",
      "Bangun baseline farm",
      "Tentukan data minimum untuk mulai membaca performa.",
      `${name}, saya belum memiliki catatan KPI farm. Susun lima data baseline yang perlu saya catat minggu ini, lengkap dengan satuan, periode, dan cara mengecek konsistensinya.`,
    );
    add(
      "daily-log",
      "Siapkan catatan harian",
      "Buat format sederhana yang siap dipakai tim lapangan.",
      "Buatkan format catatan harian farm yang ringkas untuk HDP, pakan, air, berat telur, mortalitas, suhu, dan kelembapan.",
    );
  } else {
    const changeText =
      hdpDelta === null
        ? "perbandingan minggu sebelumnya belum tersedia"
        : `${hdpDelta >= 0 ? "naik" : "turun"} ${formatValue(Math.abs(hdpDelta))} poin dari minggu sebelumnya`;
    add(
      "latest-signal",
      "Baca sinyal terbaru",
      `${weekLabel} · HDP ${formatValue(hdp)}% · ${changeText}`,
      finite(hdp)
        ? `HDP ${weekLabel} saya ${formatValue(hdp)}%${finite(previousHdp) ? `, dibanding ${formatValue(previousHdp)}% pada minggu sebelumnya` : ""}. Susun tiga pemeriksaan prioritas, data pembanding yang perlu saya siapkan, dan batas kesimpulan yang aman.`
        : `Baca sinyal operasional dari ${weekLabel} dan susun urutan pemeriksaan yang paling masuk akal sebelum saya menarik kesimpulan.`,
    );
    add(
      "context-gap",
      "Lengkapi konteks KPI",
      missingFields.length
        ? `Belum ada: ${missingFields.slice(0, 4).join(", ")}${missingFields.length > 4 ? ", dan lainnya" : ""}.`
        : "Semua kolom utama sudah terisi; cek konsistensi antarperiode.",
      missingFields.length
        ? `Untuk ${weekLabel}, data ${missingFields.join(", ")} belum tercatat. Urutkan data mana yang paling penting dilengkapi lebih dulu dan jelaskan mengapa data itu dibutuhkan untuk membaca HDP atau FCR.`
        : `Data KPI ${weekLabel} sudah cukup lengkap. Buatkan pemeriksaan konsistensi antarperiode agar angka yang tampak berubah tidak langsung dianggap sebagai masalah farm.`,
    );
    add(
      "feed-output",
      "Hubungkan pakan dan output",
      finite(latest.fcr)
        ? `FCR tercatat ${formatValue(latest.fcr)} · bedakan sinyal dari data yang belum pasti.`
        : "Gunakan feed intake, egg mass, dan FCR secara berurutan.",
      finite(latest.fcr)
        ? `FCR ${formatValue(latest.fcr)} pada ${weekLabel}. Jelaskan data pendamping yang wajib dibaca sebelum menilai efisiensi, termasuk kemungkinan masalah satuan atau pembagian dengan nol.`
        : `Susun urutan analisis hubungan feed intake, egg mass, dan FCR untuk data farm saya, termasuk data yang masih perlu dicatat.`,
    );
  }

  if (pageContext === "kpi") {
    add(
      "kpi-decision",
      "Validasi sebelum bertindak",
      "Ubah angka KPI menjadi pemeriksaan lapangan yang aman.",
      "Dari data KPI akun saya, buatkan tabel sinyal, data yang perlu divalidasi, kemungkinan penyebab, dan tindakan pertama. Pisahkan fakta dari hipotesis.",
    );
  } else if (pageContext === "calculators") {
    add(
      "calculator-check",
      "Periksa hasil hitung",
      "Pastikan rumus, satuan, dan keputusan tidak melenceng.",
      "Bantu saya memeriksa hasil kalkulator yang sedang saya gunakan: jelaskan asumsi rumus, satuan yang harus cocok, dan bagaimana hasilnya diterjemahkan menjadi keputusan farm.",
    );
  } else if (pageContext === "learning") {
    add(
      "next-learning",
      "Lanjutkan belajar dengan arah",
      `${completed} modul selesai · fokus berikutnya: ${nextModuleLabel}.`,
      `Saya sudah menyelesaikan ${completed} modul. Buatkan rencana belajar singkat untuk melanjutkan ke ${nextModuleLabel}, lalu kaitkan dengan masalah KPI farm yang sedang saya hadapi.`,
    );
  } else if (pageContext === "certification" || pageContext === "exam") {
    add(
      "readiness",
      "Ukur kesiapan belajar",
      `${completed} modul selesai · cari gap yang paling penting.`,
      `Dengan ${completed} modul selesai, buatkan checklist kesiapan belajar saya untuk sertifikasi/ujian. Tunjukkan gap yang perlu saya tutup tanpa mengarang nilai atau menjanjikan kelulusan.`,
    );
  } else {
    add(
      "next-action",
      "Pilih langkah berikutnya",
      `${completed} modul selesai · tetap selaraskan belajar dengan praktik farm.`,
      completed
        ? `Saya sudah menyelesaikan ${completed} modul. Materi atau latihan apa yang paling relevan untuk memperkuat evaluasi KPI saya saat ini? Jelaskan alasannya.`
        : "Saya baru mulai belajar. Urutkan fokus pertama yang paling penting untuk memahami performa layer farm dan langsung beri satu latihan praktis.",
    );
  }

  return suggestions.slice(0, 4);
}
