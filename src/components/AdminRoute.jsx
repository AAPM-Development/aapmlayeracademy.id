import React from "react";
import { Link, Outlet } from "react-router-dom";
import AppBrand from "@/components/AppBrand";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, StateView } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";

export function AdminAccessDenied() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-background p-6">
      <div className="grid w-full max-w-lg justify-items-center gap-6">
        <AppBrand product="aapm" className="h-10 w-auto" />
        <StateView
          kind="locked"
          titleAs="h1"
          hue="orange"
          title="Akses admin diperlukan"
          description="Akun ini terdaftar sebagai learner. Ruang admin hanya tersedia untuk akun dengan akses admin."
          action={<Button asChild><Link to="/"><AapmIcon name="dashboard" />Kembali ke Academy</Link></Button>}
        />
      </div>
    </main>
  );
}

export default function AdminRoute() {
  const { user, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return <div className="aapm-boot-screen" role="status" aria-label="Memeriksa akses"><span className="aapm-spinner" aria-hidden="true" /></div>;
  }

  return user?.role === "admin" ? <Outlet /> : <AdminAccessDenied />;
}
