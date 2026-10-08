export const adminNavigationGroups = [
  {
    label: "Administrasi",
    items: [
      { to: "/admin", label: "Ringkasan", icon: "dashboard", end: true },
      { to: "/admin/courses", label: "Course", icon: "course" },
      { to: "/admin/learners", label: "Peserta", icon: "graduation" },
      { to: "/admin/users", label: "Pengguna", icon: "users" },
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

// The bottom bar shows the primary group under the same names as the sidebar,
// so a phone user meets one vocabulary, not two.
export const adminBottomNavigation = adminPrimaryNavigation;

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
  for (const group of adminNavigationGroups) {
    const item = group.items.find((entry) => (entry.end ? pathname === entry.to : pathname.startsWith(entry.to)));
    if (item) return { ...item, group: group.label };
  }
  return { label: "Ringkasan", icon: "dashboard", to: "/admin", group: "Administrasi" };
}

// Mirrors the admin routes in App.jsx; anything else is the in-shell 404.
const knownAdminPaths = [
  /^\/admin\/?$/,
  /^\/admin\/courses(?:\/[^/]+(?:\/modules\/[^/]+)?)?\/?$/,
  /^\/admin\/learners(?:\/[^/]+)?\/?$/,
  /^\/admin\/(?:users|ai-settings|workspace-status)\/?$/,
];

function isKnownAdminPath(pathname) {
  return knownAdminPaths.some((pattern) => pattern.test(pathname));
}

/**
 * Route-derived breadcrumb trail for the admin topbar: the navigation group,
 * the page, then the record. Mirrors the academy topbar (group › page).
 */
export function getAdminBreadcrumbs(pathname = "/admin") {
  if (!isKnownAdminPath(pathname)) return [{ label: "Administrasi" }, { label: "Halaman tidak ditemukan" }];
  const meta = getAdminNavigationMeta(pathname);
  const isOverview = meta.to === "/admin";
  const trail = [{ label: meta.group }, isOverview ? { label: meta.label } : { label: meta.label, to: meta.to }];

  const course = pathname.match(/^\/admin\/courses\/([^/]+)(?:\/modules\/([^/]+))?/);
  if (course) {
    trail.push({ label: "Kurikulum", to: `/admin/courses/${course[1]}` });
    if (course[2]) trail.push({ label: course[2] === "new" ? "Modul baru" : "Editor modul" });
  }
  if (/^\/admin\/learners\/[^/]+/.test(pathname)) trail.push({ label: "Detail peserta" });
  return trail;
}
