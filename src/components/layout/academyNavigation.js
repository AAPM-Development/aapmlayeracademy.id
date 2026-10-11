const isLearningPath = (pathname) => pathname === "/modules" || pathname.startsWith("/modules/") || pathname.startsWith("/quiz/");

export const academyNavigation = [
  {
    label: "Belajar",
    items: [
      { to: "/", label: "Beranda", ic: "home", icon: "dashboard", end: true },
      { to: "/modules", label: "Jalur belajar", ic: "route", icon: "roadmap", match: isLearningPath },
      { to: "/final-exam", label: "Ujian akhir", ic: "exam", icon: "exam" },
    ],
  },
  {
    label: "Alat farm",
    items: [
      { to: "/calculators", label: "Kalkulator farm", ic: "calc", icon: "calculator" },
      { to: "/kpi", label: "Farm KPI", ic: "chart", icon: "kpi" },
      { to: "/ai-assistant", label: "Tanya APPI", ic: "sparkle", icon: "ai", accent: "ai" },
    ],
  },
  {
    label: "Prestasi",
    items: [
      { to: "/profile", label: "Prestasi & profil", ic: "medal", icon: "award" },
      { to: "/certification", label: "Sertifikasi", ic: "cert", icon: "certificate" },
    ],
  },
];

// Phone: Beranda · Belajar · APPI raised in the middle · Alat · Prestasi.
// One vocabulary with the sidebar; APPI lives here instead of a second,
// floating launcher.
export const academyBottomNavigation = [
  { to: "/", label: "Beranda", ic: "home", end: true },
  { to: "/modules", label: "Belajar", ic: "route", match: (pathname) => isLearningPath(pathname) || pathname === "/final-exam" },
  { to: "/ai-assistant", label: "APPI", appi: true },
  { to: "/calculators", label: "Alat", ic: "calc", match: (pathname) => pathname === "/calculators" || pathname === "/kpi" },
  { to: "/profile", label: "Prestasi", ic: "medal", match: (pathname) => pathname.startsWith("/profile") || pathname === "/certification" },
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

  // Every learner route is listed above, so a miss is the in-shell 404.
  return { label: "Halaman tidak ditemukan", group: "Academy" };
}
