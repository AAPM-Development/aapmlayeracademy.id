import React from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { Button, IconTile, Surface } from "@/components/primitives";
import { AdminPageFrame } from "@/components/admin/AdminPage";
import { adminPlannedCapabilities } from "@/components/admin/adminNavigationItems";

const activeAreas = [
  {
    to: "/admin/courses",
    label: "Manajemen course",
    detail: "Mengelola modul, urutan kurikulum, konten, dan bank soal.",
    icon: "course",
  },
  {
    to: "/admin/users",
    label: "Manajemen pengguna",
    detail: "Membuat akun, menetapkan admin, dan mengganti password pengguna.",
    icon: "users",
  },
  {
    to: "/admin/learners",
    label: "Peserta belajar",
    detail: "Mencari akun, progres, serta sertifikat per learner.",
    icon: "users",
  },
  {
    to: "/admin/ai-settings",
    label: "Pengaturan APPI",
    detail: "Mengelola provider, model, credential, dan test koneksi.",
    icon: "ai",
  },
];

export default function AdminWorkspaceStatus() {
  return (
    <AdminPageFrame
      eyebrow="Ruang admin"
      title="Status ruang kerja"
      description="Peta kemampuan admin berdasarkan endpoint native yang tersedia saat ini. Menu tidak berpura-pura dapat melakukan aksi yang belum didukung server."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.78fr)]">
        <Surface className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <IconTile icon="checkRead" tone="green" size="md" />
            <div>
              <h2 className="text-base font-semibold">Siap digunakan sekarang</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Area ini tersambung ke data native dan aman digunakan untuk operasi admin harian.
              </p>
            </div>
          </div>
          <div className="mt-5 divide-y divide-border rounded-xl border border-border">
            {activeAreas.map((area) => (
              <Link
                key={area.to}
                to={area.to}
                className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-surface-subtle"
              >
                <span className="aapm-token-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-orange text-brand-orange">
                  <AapmIcon name={area.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{area.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{area.detail}</span>
                </span>
                <AapmIcon name="arrowRight" className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </Surface>
        <Surface variant="muted" className="p-5 sm:p-6">
          <h2 className="text-base font-semibold">Memerlukan endpoint baru</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Ditampilkan di sini agar scope teknis jelas, tanpa dead menu atau tombol palsu.
          </p>
          <div className="mt-5 space-y-3">
            {adminPlannedCapabilities.map((area) => (
              <div key={area.label} className="flex gap-3">
                <AapmIcon name={area.icon} className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
                <div>
                  <div className="text-sm font-semibold">{area.label}</div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{area.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" className="mt-6 w-full">
             <Link to="/admin">Kembali ke ringkasan</Link>
          </Button>
        </Surface>
      </div>
    </AdminPageFrame>
  );
}
