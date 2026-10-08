import React from "react";
import { Link, useLocation } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, StateView } from "@/design-system";
import { Page, StatusPage } from "@/design-system/patterns/AppShell";
import { useAuth } from "@/lib/AuthContext";

const PATH_LIMIT = 40;

/** Keep both ends of a long address readable: "/modul-lama/ar…/akhir". */
function truncateMiddle(text, limit = PATH_LIMIT) {
  if (text.length <= limit) return text;
  const head = Math.ceil((limit - 1) / 2);
  const tail = limit - 1 - head;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

// The two likely ways back depend on who is lost: a visitor can only sign in,
// an admin stays in Ruang admin, a learner returns to the Academy.
const WAYS_BACK = {
  visitor: {
    action: { to: "/login", icon: "user", label: "Masuk" },
    secondary: { to: "/register", icon: "add", label: "Buat akun" },
  },
  admin: {
    action: { to: "/admin", icon: "dashboard", label: "Ke ringkasan admin" },
    secondary: { to: "/admin/courses", icon: "course", label: "Kelola course" },
  },
  learner: {
    action: { to: "/", icon: "dashboard", label: "Ke beranda" },
    secondary: { to: "/modules", icon: "course", label: "Jalur belajar" },
  },
};

/**
 * Unknown route: say what happened and offer the two likely ways back.
 * Signed in, it renders inside the learner or admin shell (`scope`); signed
 * out, it stands alone on the StatusPage pattern.
 */
export default function PageNotFound({ scope = "academy" }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const ways = !isAuthenticated ? WAYS_BACK.visitor : scope === "admin" ? WAYS_BACK.admin : WAYS_BACK.learner;

  const state = (
    <StateView
      kind="empty"
      titleAs="h1"
      icon="map"
      hue="orange"
      title="Halaman tidak ditemukan"
      description="Alamat ini tidak tersedia atau sudah dipindahkan."
      action={<Button asChild><Link to={ways.action.to}><AapmIcon name={ways.action.icon} />{ways.action.label}</Link></Button>}
      secondaryAction={<Button asChild variant="secondary"><Link to={ways.secondary.to}><AapmIcon name={ways.secondary.icon} />{ways.secondary.label}</Link></Button>}
    >
      <code className="aapm-state__path" title={location.pathname}>{truncateMiddle(location.pathname)}</code>
    </StateView>
  );

  return isAuthenticated ? <Page width="narrow">{state}</Page> : <StatusPage>{state}</StatusPage>;
}
