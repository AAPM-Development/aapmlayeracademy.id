export const academyNavigation = [
  {
    label: "Learn",
    items: [
      { to: "/", label: "Dashboard", icon: "dashboard", end: true },
      { to: "/modules", label: "Learning Path", icon: "course" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/calculators", label: "Farm Calculators", icon: "solar:calculator-bold-duotone" },
      { to: "/kpi", label: "Farm KPI", icon: "analytics" },
      { to: "/ai-assistant", label: "AI Farm Assistant", icon: "solar:stars-minimalistic-bold-duotone" },
    ],
  },
  {
    label: "Achievement",
    items: [
      { to: "/certification", label: "Certification", icon: "certificate" },
      { to: "/final-exam", label: "Final Exam", icon: "solar:cup-star-bold" },
    ],
  },
];

export function getNavigationMeta(pathname = "/") {
  for (const group of academyNavigation) {
    const item = group.items.find((entry) => entry.end ? pathname === entry.to : pathname.startsWith(entry.to));
    if (item) return { ...item, group: group.label };
  }

  return { label: "Academy", group: "Learn" };
}
