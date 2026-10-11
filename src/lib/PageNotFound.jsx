import React from "react";
import { Link, useLocation } from "react-router-dom";
import AppiMascot from "@/components/appi/AppiMascot";
import { Ic } from "@/design-system/canvas";
import { Page, StatusCard, StatusPage } from "@/design-system/patterns/AppShell";
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
  visitor: [
    { to: "/login", label: "Masuk" },
    { to: "/register", label: "Buat akun" },
  ],
  admin: [
    { to: "/admin", ic: "home", label: "Ke ringkasan admin" },
    { to: "/admin/courses", ic: "box", label: "Kelola course" },
  ],
  learner: [
    { to: "/", ic: "home", label: "Ke beranda" },
    { to: "/modules", ic: "route", label: "Jalur belajar" },
  ],
};

/**
 * Unknown route: say what happened and offer the two likely ways back.
 * Signed in, the card sits inside the learner or admin shell (`scope`);
 * signed out, it stands alone on the StatusPage pattern.
 */
export default function PageNotFound({ scope = "academy" }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const ways = !isAuthenticated ? WAYS_BACK.visitor : scope === "admin" ? WAYS_BACK.admin : WAYS_BACK.learner;

  const card = {
    visual: <div className="appi-stage"><AppiMascot mood="curious" size="lg" enter="pop" /></div>,
    title: "Halaman tidak ditemukan",
    text: "Alamat ini tidak tersedia atau sudah dipindahkan.",
    meta: <code className="chip chip-outline t-mono" title={location.pathname}>{truncateMiddle(location.pathname)}</code>,
    actions: ways.map((way, index) => (
      <Link key={way.to} className={`btn ${index ? "btn-secondary" : "btn-primary"} btn-lg btn-block`} to={way.to}>
        {way.ic ? <Ic name={way.ic} /> : null}{way.label}
      </Link>
    )),
  };

  return isAuthenticated ? <Page width="narrow" className="status-in-shell"><StatusCard {...card} /></Page> : <StatusPage {...card} />;
}
