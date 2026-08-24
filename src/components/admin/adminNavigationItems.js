export const adminPrimaryNavigation = [
  { to: "/admin", label: "Overview", icon: "dashboard", end: true },
  { to: "/admin/courses", label: "Course Management", icon: "course" },
  { to: "/admin/users", label: "User management", icon: "users" },
  { to: "/admin/ai-settings", label: "AI Settings", icon: "ai" },
];

export const adminSecondaryNavigation = [
  {
    to: "/admin/workspace-status",
    label: "Workspace status",
    icon: "solar:clipboard-list-bold-duotone",
  },
];

export const adminPlannedCapabilities = [
  {
    label: "Certificates",
    detail: "Data sertifikat sudah dapat dibaca per learner; penerbitan global memerlukan endpoint baru.",
    icon: "certificate",
  },
  {
    label: "Media library",
    detail: "Upload dan manajemen media perlu penyimpanan server yang dikelola secara terpisah.",
    icon: "media",
  },
  {
    label: "Analytics",
    detail: "Ringkasan live tersedia di Overview; laporan terjadwal belum memiliki API native.",
    icon: "analytics",
  },
];
