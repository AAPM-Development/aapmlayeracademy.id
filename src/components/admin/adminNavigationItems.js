export const adminPrimaryNavigation = [
  { to: "/admin", label: "Ringkasan", icon: "dashboard", end: true },
  { to: "/admin/courses", label: "Manajemen course", icon: "course" },
  { to: "/admin/users", label: "Manajemen pengguna", icon: "users" },
  { to: "/admin/ai-settings", label: "Pengaturan AI", icon: "ai" },
];

export const adminSecondaryNavigation = [
  {
    to: "/admin/workspace-status",
    label: "Status ruang kerja",
    icon: "solar:clipboard-list-bold-duotone",
  },
];

export const adminPlannedCapabilities = [
  {
    label: "Sertifikat",
    detail: "Data sertifikat sudah dapat dibaca per learner; penerbitan global memerlukan endpoint baru.",
    icon: "certificate",
  },
  {
    label: "Pustaka media",
    detail: "Upload dan manajemen media perlu penyimpanan server yang dikelola secara terpisah.",
    icon: "media",
  },
  {
    label: "Analitik",
    detail: "Ringkasan live tersedia di Overview; laporan terjadwal belum memiliki API native.",
    icon: "analytics",
  },
];
