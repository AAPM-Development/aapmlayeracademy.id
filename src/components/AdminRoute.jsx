import React from "react";
import { Link, Outlet } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, StateView } from "@/components/primitives";
import { StatusPage } from "@/design-system/patterns/AppShell";
import { useAuth } from "@/lib/AuthContext";

export function AdminAccessDenied() {
  return (
    <StatusPage>
      <StateView
        kind="locked"
        titleAs="h1"
        hue="orange"
        title="Akses admin diperlukan"
        description="Akun ini terdaftar sebagai learner. Ruang admin hanya tersedia untuk akun dengan akses admin."
        action={<Button asChild><Link to="/"><AapmIcon name="dashboard" />Kembali ke Academy</Link></Button>}
      />
    </StatusPage>
  );
}

export default function AdminRoute() {
  const { user, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return <div className="aapm-boot-screen" role="status" aria-label="Memeriksa akses"><span className="aapm-spinner" aria-hidden="true" /></div>;
  }

  return ["admin", "super_admin"].includes(user?.role) ? <Outlet /> : <AdminAccessDenied />;
}
