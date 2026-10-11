import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useModules } from "@/lib/useCourseData";
import { getLevelForModule, sortModules } from "@/lib/academyData";
import { CommandTrigger } from "@/design-system/patterns/AppShell";
import SearchPalette, { useCommandShortcut } from "./SearchPalette";

const destinations = [
  { key: "calc", ic: "calc", hue: "teal", title: "Kalkulator farm", meta: "FCR, HDP, egg mass, uniformity", to: "/calculators" },
  { key: "kpi", ic: "chart", hue: "blue", title: "Farm KPI", meta: "Catat dan baca KPI mingguan", to: "/kpi" },
  { key: "appi", ic: "sparkle", hue: "ai", title: "Tanya APPI", meta: "Asisten belajar dan farm", to: "/ai-assistant" },
  { key: "path", ic: "route", hue: "green", title: "Jalur belajar", meta: "14 level · 22 modul", to: "/modules" },
  { key: "exam", ic: "exam", hue: "gold", title: "Ujian akhir", meta: "Sertifikasi Expert", to: "/final-exam" },
  { key: "cert", ic: "cert", hue: "teal", title: "Sertifikasi", meta: "6 tingkat sertifikat", to: "/certification" },
  { key: "profile", ic: "medal", hue: "violet", title: "Prestasi & profil", meta: "Poin, peringkat, Hall of Fame", to: "/profile" },
];

const searchable = (value) => String(value || "").toLocaleLowerCase("id-ID");

/** Topbar command search for learners: modules, farm tools and pages. */
export default function LearnerQuickSearch() {
  const navigate = useNavigate();
  const { data: modules = [] } = useModules();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const openPalette = useCallback(() => setOpen(true), []);
  useCommandShortcut(openPalette);

  const term = searchable(query).trim();
  const go = (to) => { setOpen(false); setQuery(""); navigate(to); };

  const groups = useMemo(() => {
    const moduleItems = sortModules(modules)
      .filter((module) => !term || searchable(`${module.moduleNumber} ${module.title} ${getLevelForModule(module)?.name || ""}`).includes(term))
      .slice(0, term ? 8 : 4)
      .map((module) => ({
        key: `m-${module.moduleNumber}`,
        ic: "book",
        hue: "blue",
        title: module.title,
        meta: `Modul ${module.moduleNumber}${getLevelForModule(module) ? ` · Level ${getLevelForModule(module).number} ${getLevelForModule(module).name}` : ""}`,
        onSelect: () => go(`/modules/${module.moduleNumber}`),
      }));
    const pageItems = destinations
      .filter((item) => !term || searchable(`${item.title} ${item.meta}`).includes(term))
      .map((item) => ({ ...item, onSelect: () => go(item.to) }));
    return [{ label: "Alat & halaman", items: pageItems }, { label: "Modul", items: moduleItems }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, term]);

  const empty = groups.every((group) => !group.items.length);

  return (
    <>
      <CommandTrigger label="Cari modul, kalkulator, atau topik" onOpen={openPalette} />
      <SearchPalette
        open={open}
        onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}
        title="Cari modul, kalkulator, atau topik"
        description="Cari judul atau nomor modul, alat farm, dan halaman Academy."
        placeholder="Contoh: brooding, FCR, Modul 5"
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        status={empty ? "Tidak ada yang cocok. Coba kata lain." : null}
      />
    </>
  );
}
