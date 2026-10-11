import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { nativeApi } from "@/api/nativeClient";
import { AdminPageFrame } from "@/components/admin/AdminPage";
import { adminPlannedCapabilities } from "@/components/admin/adminNavigationItems";
import AapmIcon from "@/components/icons/AapmIcon";
import { Ic } from "@/design-system/canvas";

const activeAreas = [
  { to: "/admin/courses", label: "Course & kurikulum", detail: "Modul, urutan, konten, dan bank soal.", ic: "box", hue: "blue" },
  { to: "/admin/curriculum/policies", label: "Kebijakan kurikulum", detail: "Persyaratan berversi untuk angkatan baru.", ic: "route", hue: "teal" },
  { to: "/admin/curriculum/final-bank", label: "Bank ujian akhir", detail: "Draf, validasi, dan penerbitan soal.", ic: "exam", hue: "violet" },
  { to: "/admin/learners", label: "Peserta", detail: "Progres, nilai, dan sertifikat per peserta.", ic: "grad", hue: "green" },
  { to: "/admin/certificates", label: "Sertifikat", detail: "Penerbitan, bukti, dan pencabutan tercatat.", ic: "cert", hue: "amber" },
  { to: "/admin/users", label: "Pengguna", detail: "Akun, peran admin, dan kata sandi.", ic: "users", hue: "rose" },
  { to: "/admin/ai-settings", label: "Pengaturan APPI", detail: "Penyedia, model, dan uji koneksi.", ic: "sparkle", hue: "ai" },
];

const ENVIRONMENT_LABEL = { production: "Produksi", staging: "Staging", local: "Lokal" };
const DRIVER_LABEL = { mysql: "MySQL", sqlite: "SQLite" };

/** Admin capability map: what is wired to native endpoints, and what is still staged. */
export default function AdminWorkspaceStatus() {
  const status = useQuery({ queryKey: ["admin", "workspace-status"], queryFn: () => nativeApi.admin.workspaceStatus() });
  const environment = status.data?.environment;

  return (
    <AdminPageFrame title="Status ruang kerja" description="Peta kemampuan admin berdasarkan endpoint native yang tersedia saat ini.">
      <div className="split stretch">
        <section className="card anim-rise" aria-labelledby="ready-title">
          <div className="card-pad card-head">
            <div className="stack gap-0-5"><h2 className="card-title" id="ready-title">Siap digunakan</h2><p className="card-desc">Area yang sudah terhubung ke endpoint native.</p></div>
            <span className="chip chip-success">{activeAreas.length} area</span>
          </div>
          <ul className="stack gap-2" style={{ padding: "0 var(--card-pad) var(--card-pad)" }}>
            {activeAreas.map((area) => (
              <li key={area.to}>
                <Link className="card card-tactile row gap-3" to={area.to} data-hue={area.hue} style={{ padding: "10px 16px" }}>
                  <span className="tile tile-sm"><Ic name={area.ic} /></span>
                  <span className="stack grow" style={{ minWidth: 0 }}><span className="li-title t-strong t-clamp-1">{area.label}</span><span className="li-meta t-clamp-2">{area.detail}</span></span>
                  <span className="chip chip-success chip-dot">Aktif</span>
                  <Ic name="chev-right" size="sm" className="t-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="stack gap-grid" aria-label="Area bertahap dan lingkungan">
          <section className="card card-muted anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 1 })} aria-labelledby="stage-title">
            <div className="card-pad card-head" style={{ paddingBottom: 8 }}>
              <h2 className="card-title" id="stage-title">Bertahap</h2>
              <span className="chip chip-outline"><Ic name="clock" />Menunggu server</span>
            </div>
            <ul className="list">
              {adminPlannedCapabilities.map((area) => (
                <li key={area.label} className="li" style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}>
                  <span className="row none" style={{ height: 24 }}><AapmIcon name={area.icon} className="t-muted" /></span>
                  <span className="stack grow gap-0-5"><span className="row between gap-2"><span className="li-title t-strong">{area.label}</span><span className="chip chip-outline">{area.status}</span></span><span className="li-meta">{area.detail}</span></span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 2, flex: "1 1 auto" })} aria-labelledby="env-title">
            <div className="card-pad stack gap-4">
              <div className="card-head">
                <div className="stack gap-0-5"><h2 className="card-title" id="env-title">Lingkungan</h2><p className="card-desc">Konfigurasi server yang terbaca.</p></div>
                <span className="tile tile-sm" data-hue="neutral"><Ic name="server" /></span>
              </div>
              {status.isLoading ? (
                <div className="stack gap-2" aria-busy="true"><span className="skel" style={{ height: 18 }} /><span className="skel" style={{ height: 18 }} /><span className="skel" style={{ height: 18 }} /></div>
              ) : status.error ? (
                <p className="t-support t-danger">{status.error.message}</p>
              ) : (
                <dl className="dl" style={{ rowGap: 12, alignItems: "center" }}>
                  <dt>Lingkungan</dt><dd><span className={`chip chip-dot ${environment === "production" ? "chip-success" : environment === "staging" ? "chip-info" : ""}`}>{ENVIRONMENT_LABEL[environment] || environment || "—"}</span></dd>
                  <dt>Basis data</dt><dd>{DRIVER_LABEL[status.data?.databaseDriver] || status.data?.databaseDriver || "—"}</dd>
                  <dt>PHP</dt><dd>{status.data?.phpVersion || "—"}</dd>
                  <dt>Penanda lingkungan</dt><dd>{status.data?.environmentMarker === "verified" ? <span className="row gap-1-5 justify-end t-success"><Ic name="check-circle" size="sm" />Terverifikasi</span> : <span className="t-muted">Tidak diwajibkan</span>}</dd>
                </dl>
              )}
            </div>
            <div className="card-foot mt-auto">
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }} disabled={status.isFetching} onClick={() => status.refetch()}><Ic name="refresh" />Periksa ulang</button>
            </div>
          </section>
        </aside>
      </div>
    </AdminPageFrame>
  );
}
