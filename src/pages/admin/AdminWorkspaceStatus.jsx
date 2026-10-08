import React from "react";
import { Link } from "react-router-dom";
import AapmIcon from "@/components/icons/AapmIcon";
import { Badge, Button, IconTile, Surface } from "@/components/primitives";
import { AdminPageFrame } from "@/components/admin/AdminPage";
import { adminPlannedCapabilities } from "@/components/admin/adminNavigationItems";

const activeAreas = [
  {
    to: "/admin/courses",
    label: "Manajemen course",
    detail: "Mengelola modul, urutan kurikulum, konten, dan bank soal.",
    icon: "course",
    hue: "orange",
  },
  {
    to: "/admin/users",
    label: "Manajemen pengguna",
    detail: "Membuat akun, menetapkan admin, dan mengganti password pengguna.",
    icon: "users",
    hue: "green",
  },
  {
    to: "/admin/learners",
    label: "Peserta belajar",
    detail: "Mencari akun, progres, serta sertifikat per learner.",
    icon: "users",
    hue: "blue",
  },
  {
    to: "/admin/ai-settings",
    label: "Pengaturan APPI",
    detail: "Mengelola provider, model, credential, dan test koneksi.",
    icon: "ai",
    hue: "violet",
  },
];

export default function AdminWorkspaceStatus() {
  return (
    <AdminPageFrame
      title="Status ruang kerja"
      description="Peta kemampuan admin berdasarkan endpoint native yang tersedia saat ini. Menu tidak berpura-pura dapat melakukan aksi yang belum didukung server."
    >
      <div className="aapm-admin-split">
        <Surface className="aapm-admin-panel">
          <div className="aapm-panel-head">
            <div className="min-w-0">
              <h2 className="aapm-panel-head__title">Siap digunakan sekarang</h2>
              <p className="aapm-panel-head__desc">Area ini tersambung ke data native dan aman dipakai untuk operasi harian.</p>
            </div>
            <Badge variant="soft" hue="green">{activeAreas.length} area</Badge>
          </div>
          <nav className="aapm-link-list" aria-label="Area admin yang tersedia">
            {activeAreas.map((area) => (
              <Link key={area.to} to={area.to} className="aapm-link-list__item">
                <IconTile icon={area.icon} hue={area.hue} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{area.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{area.detail}</span>
                </span>
                <AapmIcon name="arrowRight" className="aapm-link-list__chevron" />
              </Link>
            ))}
          </nav>
        </Surface>

        <Surface variant="muted" className="aapm-admin-panel">
          <div className="aapm-panel-head">
            <div className="min-w-0">
              <h2 className="aapm-panel-head__title">Memerlukan endpoint baru</h2>
              <p className="aapm-panel-head__desc">Ditampilkan agar cakupan teknis jelas, tanpa menu mati atau tombol palsu.</p>
            </div>
            <Badge variant="outline">Menunggu server</Badge>
          </div>
          <ul className="aapm-planned-list">
            {adminPlannedCapabilities.map((area) => (
              <li key={area.label} className="aapm-planned-list__item">
                <AapmIcon name={area.icon} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{area.label}</div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{area.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="aapm-admin-panel__footer">
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin">Kembali ke ringkasan</Link>
            </Button>
          </div>
        </Surface>
      </div>
    </AdminPageFrame>
  );
}
