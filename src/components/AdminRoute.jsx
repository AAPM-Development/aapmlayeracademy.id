import React from "react";
import { Link, Outlet } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import AppBrand from "@/components/AppBrand";
import { Button, Surface } from "@/components/primitives";
import { useAuth } from "@/lib/AuthContext";

export function AdminAccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <Surface className="w-full max-w-md p-7 text-center sm:p-9">
        <AppBrand product="aapm" className="mx-auto h-11 w-auto" />
        <div className="mx-auto mt-7 flex h-11 w-11 items-center justify-center rounded-xl bg-tint-orange text-tint-orange-foreground">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Akses admin diperlukan</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Akun ini terdaftar sebagai learner. Workspace admin hanya tersedia untuk akun dengan akses admin.</p>
        <Button asChild className="mt-6 bg-brand-green text-white hover:bg-brand-green/90"><Link to="/">Kembali ke Academy</Link></Button>
      </Surface>
    </main>
  );
}

export default function AdminRoute() {
  const { user, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return <div className="fixed inset-0 grid place-items-center bg-background"><span className="h-7 w-7 animate-spin rounded-full border-4 border-muted border-t-brand-green" /></div>;
  }

  return user?.role === "admin" ? <Outlet /> : <AdminAccessDenied />;
}
