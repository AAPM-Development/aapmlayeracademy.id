import {
  Award,
  BarChart3,
  BookOpen,
  Calculator,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

export const academyNavigation = [
  {
    label: "Learn",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/modules", label: "Learning Path", icon: BookOpen },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/calculators", label: "Farm Calculators", icon: Calculator },
      { to: "/kpi", label: "Farm KPI", icon: BarChart3 },
      { to: "/ai-assistant", label: "AI Farm Assistant", icon: Sparkles },
    ],
  },
  {
    label: "Achievement",
    items: [
      { to: "/certification", label: "Certification", icon: Award },
      { to: "/final-exam", label: "Final Exam", icon: GraduationCap },
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
