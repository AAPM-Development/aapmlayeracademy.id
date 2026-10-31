import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CommandTrigger } from "@/design-system/patterns/AppShell";
import SearchPalette, { useCommandShortcut } from "@/components/search/SearchPalette";
import { nativeApi } from "@/api/nativeClient";

function searchable(value) {
  return String(value || "").toLocaleLowerCase("id-ID");
}

export default function AdminQuickSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const normalizedQuery = searchable(debouncedQuery).trim();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  const openPalette = useCallback(() => setOpen(true), []);
  useCommandShortcut(openPalette);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  // Modules from every curriculum are searchable.
  const courseQuery = useQuery({
    queryKey: ["admin", "quick-search", "catalogue"],
    queryFn: () => nativeApi.admin.courses.list({ withCurriculum: true }),
    enabled: open && normalizedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
  const learnersQuery = useQuery({
    queryKey: ["admin", "quick-search", "learners", normalizedQuery],
    queryFn: () => nativeApi.admin.learners.list(normalizedQuery),
    enabled: open && normalizedQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  const modules = useMemo(() => {
    const courses = courseQuery.data?.courses || [];
    return courses.flatMap((course) => (course.curriculum || []).flatMap((chapter) => (chapter.modules || []).map((module) => ({
      ...module, levelName: chapter.levelName, courseId: course.id, courseTitle: courses.length > 1 ? course.title : "",
    }))));
  }, [courseQuery.data]);
  const moduleMatches = normalizedQuery.length < 2 ? [] : modules.filter((module) => (
    searchable(`${module.title} ${module.displayNumber ?? module.moduleNumber} ${module.levelName} ${module.courseTitle}`).includes(normalizedQuery)
  )).slice(0, 6);
  const learnerMatches = (learnersQuery.data?.learners || []).slice(0, 6);
  const hasQuery = normalizedQuery.length >= 2;
  const isSearching = hasQuery && (learnersQuery.isFetching || courseQuery.isFetching);
  const hasError = hasQuery && (learnersQuery.isError || courseQuery.isError);
  const hasResults = learnerMatches.length + moduleMatches.length > 0;

  const openResult = (path) => {
    setOpen(false);
    navigate(path);
  };

  const status = !hasQuery
    ? "Ketik sedikitnya dua karakter untuk mulai mencari."
    : isSearching
      ? "Mencari di data Academy…"
      : hasError
        ? "Hasil pencarian belum dapat dimuat. Coba lagi sebentar."
        : !hasResults
          ? "Tidak ada peserta atau modul yang cocok."
          : null;

  return (
    <>
      <CommandTrigger label="Cari peserta atau modul" onOpen={openPalette} />
      <SearchPalette
        open={open}
        onOpenChange={setOpen}
        title="Cari peserta atau modul"
        description="Cari nama, email, judul, atau nomor modul pada data Academy."
        placeholder="Contoh: Rina atau Modul 4"
        query={query}
        onQueryChange={setQuery}
        status={status}
        groups={[
          {
            label: "Peserta",
            items: learnerMatches.map((learner) => ({
              key: `l-${learner.id}`,
              ic: "grad",
              hue: "green",
              title: learner.full_name || learner.email,
              meta: learner.email,
              onSelect: () => openResult(`/admin/learners/${learner.id}`),
            })),
          },
          {
            label: "Modul",
            items: moduleMatches.map((module) => ({
              key: `m-${module.id}`,
              ic: "book",
              hue: "blue",
              title: module.title || `Modul ${module.displayNumber ?? module.moduleNumber}`,
              meta: `${module.courseTitle ? `${module.courseTitle} · ` : ""}Modul ${module.displayNumber ?? module.moduleNumber} · ${module.levelName}`,
              onSelect: () => openResult(`/admin/courses/${module.courseId}/modules/${module.id}`),
            })),
          },
        ]}
      />
    </>
  );
}
