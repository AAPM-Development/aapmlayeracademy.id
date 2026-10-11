import React from "react";
import { Link, Outlet } from "react-router-dom";
import AppiMascot from "@/components/appi/AppiMascot";
import { Ic } from "@/design-system/canvas";
import { StatusPage, StatusTile } from "@/design-system/patterns/AppShell";
import { useAuth } from "@/lib/AuthContext";

const ROLE_LABEL = { learner: "Peserta", admin: "Admin", super_admin: "Super Admin" };

export function AdminAccessDenied() {
  const { user, logout } = useAuth();
  return (
    <StatusPage
      visual={<StatusTile ic="lock" tone="info" />}
      title="Akses admin diperlukan"
      text="Akun ini terdaftar sebagai peserta. Ruang admin hanya tersedia untuk akun dengan akses admin."
      meta={user?.email ? <span className="chip chip-outline"><Ic name="user" />{user.email} · {ROLE_LABEL[user.role] || "Peserta"}</span> : null}
      actions={(
        <>
          <Link className="btn btn-primary btn-lg btn-block" to="/"><Ic name="arrow-left" />Kembali ke Academy</Link>
          <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => logout(true)}><Ic name="logout" />Masuk dengan akun admin</button>
        </>
      )}
    />
  );
}

export default function AdminRoute() {
  const { user, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return <StatusPage busy title="Memeriksa akses…" visual={<div className="appi-stage"><AppiMascot mood="loading" size="xl" /></div>} />;
  }

  return ["admin", "super_admin"].includes(user?.role) ? <Outlet /> : <AdminAccessDenied />;
}
