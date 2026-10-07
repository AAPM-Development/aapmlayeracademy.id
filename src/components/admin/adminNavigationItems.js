export const adminNavigationGroups = [
  {
    label: "Administrasi",
    items: [
      { to: "/admin", label: "Ringkasan", icon: "dashboard", end: true },
      { to: "/admin/courses", label: "Manajemen course", icon: "course" },
      { to: "/admin/learners", label: "Peserta", icon: "graduation" },
      { to: "/admin/users", label: "Pengguna & akses", icon: "users" },
    ],
  },
  {
    label: "Ruang kerja",
    items: [
      { to: "/admin/ai-settings", label: "Pengaturan APPI", icon: "ai", accent: "ai" },
      { to: "/admin/workspace-status", label: "Status ruang kerja", icon: "workspace" },
    ],
  },
];

export const adminPrimaryNavigation = adminNavigationGroups[0].items;
export const adminSecondaryNavigation = adminNavigationGroups[1].items;

export const adminBottomNavigation = [
  { to: "/admin", label: "Ringkasan", icon: "dashboard", end: true },
  { to: "/admin/courses", label: "Course", icon: "course" },
  { to: "/admin/learners", label: "Peserta", icon: "graduation" },
  { to: "/admin/users", label: "Pengguna", icon: "users" },
];

export const adminPlannedCapabilities = [
  {
    label: "Sertifikat",
    detail: "Data sertifikat sudah dapat dibaca per learner; penerbitan global memerlukan endpoint baru.",
    icon: "certificate",
  },
  {
    label: "Pustaka media",
    detail: "Gambar dan presentasi PPTX dapat diunggah langsung dari editor modul; pustaka lintas-modul masih bertahap.",
    icon: "media",
  },
  {
    label: "Analitik",
    detail: "Ringkasan live tersedia di Overview; laporan terjadwal belum memiliki API native.",
    icon: "analytics",
  },
];

export function getAdminNavigationMeta(pathname = "/admin") {
  const items = adminNavigationGroups.flatMap((group) => group.items);
  const item = items.find((entry) => (entry.end ? pathname === entry.to : pathname.startsWith(entry.to)));
  return item || { label: "Ringkasan", icon: "dashboard", to: "/admin" };
}

/** Route-derived breadcrumb trail for the admin topbar. */
export function getAdminBreadcrumbs(pathname = "/admin") {
  const meta = getAdminNavigationMeta(pathname);
  const trail = [{ label: "Admin", to: "/admin" }];
  if (meta.to !== "/admin") trail.push({ label: meta.label, to: meta.to });

  const course = pathname.match(/^\/admin\/courses\/([^/]+)(?:\/modules\/([^/]+))?/);
  if (course) {
    trail.push({ label: "Kurikulum", to: `/admin/courses/${course[1]}` });
    if (course[2]) trail.push({ label: course[2] === "new" ? "Modul baru" : "Editor modul" });
  }
  if (/^\/admin\/learners\/[^/]+/.test(pathname)) trail.push({ label: "Detail peserta" });
  if (pathname === "/admin") trail[0] = { label: "Admin" };
  return trail;
}
