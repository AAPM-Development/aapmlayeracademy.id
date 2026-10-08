import React from "react";
import { Link, useLocation } from "react-router-dom";
import AppBrand from "@/components/AppBrand";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, StateView } from "@/design-system";

/** Unknown route: say what happened and offer the two likely ways back. */
export default function PageNotFound() {
  const location = useLocation();
  return (
    <main className="grid min-h-[100svh] place-items-center bg-background p-6">
      <div className="grid w-full max-w-lg justify-items-center gap-6">
        <AppBrand className="h-10 w-auto" />
        <StateView
          kind="empty"
          titleAs="h1"
          icon="map"
          hue="orange"
          title="Halaman tidak ditemukan"
          description={`Alamat "${location.pathname}" tidak tersedia atau sudah dipindahkan.`}
          secondaryAction={<Button asChild variant="secondary"><Link to="/modules"><AapmIcon name="course" />Jalur belajar</Link></Button>}
          action={<Button asChild><Link to="/"><AapmIcon name="dashboard" />Ke beranda</Link></Button>}
        />
      </div>
    </main>
  );
}
