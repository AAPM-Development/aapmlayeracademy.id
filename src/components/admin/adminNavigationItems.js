export const adminNavigationGroups = [
  {
    label: "",
    items: [{ to: "/admin", label: "Ringkasan", ic: "home", icon: "dashboard", end: true }],
  },
  {
    label: "Konten",
    items: [
      { to: "/admin/courses", label: "Course & kurikulum", ic: "box", icon: "course" },
      { to: "/admin/curriculum/policies", label: "Kebijakan kurikulum", ic: "route", icon: "roadmap" },
      { to: "/admin/curriculum/final-bank", label: "Bank ujian akhir", ic: "exam", icon: "quiz" },
    ],
  },
  {
    label: "Peserta & akses",
    items: [
      { to: "/admin/learners", label: "Peserta", ic: "grad", icon: "graduation" },
      { to: "/admin/certificates", label: "Sertifikat", ic: "cert", icon: "certificate" },
      { to: "/admin/users", label: "Pengguna", ic: "users", icon: "users" },
    ],
  },
  {
    label: "Sistem",
    items: [
      { to: "/admin/ai-settings", label: "Pengaturan APPI", ic: "sparkle", icon: "ai", accent: "ai" },
      { to: "/admin/workspace-status", label: "Status ruang kerja", ic: "server", icon: "workspace" },
    ],
  },
];

export const adminPrimaryNavigation = adminNavigationGroups[1].items;
export const adminSecondaryNavigation = [
  ...adminNavigationGroups[2].items,
  ...adminNavigationGroups[3].items,
];

// The bottom bar shows the most used admin destinations under the same names
// as the sidebar, so a phone user meets one vocabulary, not two. Four items
// plus Menu keep every label whole on a 375px phone; the rest live in Menu.
export const adminBottomNavigation = [
  { to: "/admin", label: "Ringkasan", ic: "home", icon: "dashboard", end: true },
  // Phone tabs are ~70px wide: the long sidebar label wraps out of its pill.
  { ...adminNavigationGroups[1].items[0], label: "Kurikulum" },
  adminNavigationGroups[2].items[0],
  adminNavigationGroups[2].items[2],
];

export const adminPlannedCapabilities = [
  {
    label: "Pustaka media",
    status: "Sebagian",
    detail: "Unggah dari editor modul sudah bisa; pustaka lintas modul masih bertahap.",
    icon: "media",
  },
  {
    label: "Laporan terjadwal",
    status: "Belum tersedia",
    detail: "Ringkasan langsung tersedia di Ringkasan; laporan terjadwal belum memiliki API native.",
    icon: "calendar",
  },
];

export function getAdminNavigationMeta(pathname = "/admin") {
  for (const group of adminNavigationGroups) {
    const item = group.items.find((entry) => (entry.end ? pathname === entry.to : pathname.startsWith(entry.to)));
    if (item) return { ...item, group: group.label };
  }
  return { label: "Ringkasan", icon: "dashboard", to: "/admin", group: "Ringkasan" };
}

// Mirrors the admin routes in App.jsx; anything else is the in-shell 404.
const knownAdminPaths = [
  /^\/admin\/curriculum\/(?:policies|final-bank)\/?$/,
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
  if (!isKnownAdminPath(pathname)) return [{ label: "Admin", to: "/admin" }, { label: "Halaman tidak ditemukan" }];
  if (pathname === "/admin/courses") return [{ label: "Admin", to: "/admin" }, { label: "Konten" }, { label: "Course" }];

  const course = pathname.match(/^\/admin\/courses\/([^/]+)(?:\/modules\/([^/]+))?/);
  if (course) {
    const trail = [
      { label: "Admin", to: "/admin" },
      { label: "Course", to: "/admin/courses" },
      { label: "Kurikulum", to: `/admin/courses/${course[1]}` },
    ];
    if (course[2]) trail.push({ label: course[2] === "new" ? "Modul baru" : "Editor modul" });
    return trail;
  }

  if (/^\/admin\/learners\/[^/]+/.test(pathname)) {
    return [
      { label: "Admin", to: "/admin" },
      { label: "Peserta", to: "/admin/learners" },
      { label: "Detail peserta" },
    ];
  }

  const meta = getAdminNavigationMeta(pathname);
  const isOverview = meta.to === "/admin";
  const trail = isOverview
    ? [{ label: "Admin", to: "/admin" }, { label: meta.label }]
    : [{ label: "Admin", to: "/admin" }, { label: meta.group }, { label: meta.label, to: meta.to }];
  return trail;
}
