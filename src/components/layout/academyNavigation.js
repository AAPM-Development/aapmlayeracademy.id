export const academyNavigation = [
  {
    label: "Belajar",
    items: [
      { to: "/", label: "Beranda", icon: "dashboard", end: true },
      { to: "/modules", label: "Jalur belajar", icon: "course" },
    ],
  },
  {
    label: "Alat farm",
    items: [
      {
        to: "/calculators",
        label: "Kalkulator farm",
        icon: "solar:calculator-bold-duotone",
      },
      { to: "/kpi", label: "Farm KPI", icon: "kpi" },
      {
        to: "/ai-assistant",
        label: "APPI",
        icon: "ai",
      },
    ],
  },
  {
    label: "Prestasi",
    items: [
      { to: "/profile", label: "Profil & prestasi", icon: "solar:user-circle-bold-duotone" },
      { to: "/certification", label: "Sertifikasi", icon: "certificate" },
      { to: "/final-exam", label: "Ujian akhir", icon: "solar:cup-star-bold" },
    ],
  },
];

export function getNavigationMeta(pathname = "/") {
  for (const group of academyNavigation) {
    const item = group.items.find((entry) =>
      entry.end ? pathname === entry.to : pathname.startsWith(entry.to),
    );
    if (item) return { ...item, group: group.label };
  }

  return { label: "Academy", group: "Belajar" };
}
