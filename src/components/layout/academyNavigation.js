export const academyNavigation = [
  {
    label: "Belajar",
    items: [
      { to: "/", label: "Beranda", icon: "dashboard", end: true },
      { to: "/modules", label: "Jalur belajar", icon: "course", match: (pathname) => pathname === "/modules" || pathname.startsWith("/modules/") || pathname.startsWith("/quiz/") },
    ],
  },
  {
    label: "Alat farm",
    items: [
      { to: "/calculators", label: "Kalkulator farm", icon: "calculator" },
      { to: "/kpi", label: "Farm KPI", icon: "kpi" },
      { to: "/ai-assistant", label: "APPI", icon: "ai", accent: "ai" },
    ],
  },
  {
    label: "Prestasi",
    items: [
      { to: "/profile", label: "Profil & prestasi", icon: "user" },
      { to: "/certification", label: "Sertifikasi", icon: "certificate" },
      { to: "/final-exam", label: "Ujian akhir", icon: "exam" },
    ],
  },
];

export const academyBottomNavigation = [
  { to: "/", label: "Beranda", icon: "dashboard", end: true },
  { to: "/modules", label: "Belajar", icon: "course", match: (pathname) => pathname.startsWith("/modules") || pathname.startsWith("/quiz/") },
  { to: "/ai-assistant", label: "APPI", icon: "ai", accent: "ai" },
  { to: "/kpi", label: "KPI", icon: "kpi" },
];

/** Routes that open in the focused learning shell instead of the app shell. */
export function isFocusRoute(pathname = "/") {
  return /^\/(?:modules\/[^/]+|quiz\/[^/]+|final-exam)\/?$/.test(pathname);
}

export function getNavigationMeta(pathname = "/") {
  for (const group of academyNavigation) {
    const item = group.items.find((entry) =>
      entry.match ? entry.match(pathname) : entry.end ? pathname === entry.to : pathname.startsWith(entry.to),
    );
    if (item) return { ...item, group: group.label };
  }

  return { label: "Academy", group: "Belajar" };
}
