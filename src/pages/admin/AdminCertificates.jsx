// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog, DataTable, useToast } from "@/components/primitives";
import { useAdminCertificate, useAdminCertificates, useRevokeAdminCertificate } from "@/lib/useAdminData";
import { AdminError, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";
import { initialsOf } from "@/components/ProfileAvatar";
import { copyText } from "@/lib/clipboard";
import { Ic } from "@/design-system/canvas";

const PAGE_SIZE = 10;
const TIERS = [
  { number: 1, short: "Foundation" },
  { number: 2, short: "Operator" },
  { number: 3, short: "Supervisor" },
  { number: 4, short: "Manager" },
  { number: 5, short: "Advanced" },
  { number: 6, short: "Expert" },
];
const TIER_HUES = ["green", "teal", "blue", "violet", "rose", "gold"];
const AVATAR_HUES = ["green", "blue", "violet", "teal", "amber", "rose"];
const tierHue = (number) => TIER_HUES[(Number(number) - 1) % 6] || "green";
const tierShort = (number, fallback) => TIERS.find((tier) => tier.number === Number(number))?.short || fallback;
const EVIDENCE_LABEL = { verified_module_quiz: "Kuis terverifikasi", verified_module_acknowledgement: "Konfirmasi belajar terverifikasi", verified_final_exam: "Ujian akhir terverifikasi" };
const EVENT_LABEL = { issued: "Diterbitkan", revoked: "Dicabut", reissued: "Diterbitkan ulang" };
const policyLabel = (version) => String(version || "").replace(/^academy-v(\d+)$/i, "Academy v$1") || "—";

/**
 * Administrative view of certificate issuance. It only reads server records; the
 * one write is an audited revocation with a reason. Legacy rows are listed apart
 * and are never presented as verified issuances.
 */
export default function AdminCertificates() {
  const { toast } = useToast();
  const [source, setSource] = useState("verified");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const filters = { source, limit: PAGE_SIZE, offset: page * PAGE_SIZE, ...(status && source === "verified" ? { status } : {}), ...(tier ? { tier } : {}) };
  const { data, isLoading, error, refetch } = useAdminCertificates(filters);
  const detail = useAdminCertificate(selected);
  const revoke = useRevokeAdminCertificate();
  const needle = search.trim().toLowerCase();
  const items = (data?.items ?? []).filter((item) => !needle || [item.learner?.name, item.learner?.email, item.publicId].some((value) => String(value || "").toLowerCase().includes(needle)));
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => setPage(0), [source, status, tier]);
  useEffect(() => { setReason(""); }, [selected]);

  const confirmRevoke = async () => {
    setConfirmOpen(false);
    try {
      await revoke.mutateAsync({ publicId: selected, reason: reason.trim() });
      toast({ title: "Sertifikat dicabut", description: "Pencabutan tercatat di jejak audit." });
      setReason("");
    } catch (failure) {
      toast({ variant: "destructive", title: "Sertifikat belum dicabut", description: failure?.message || "Coba lagi." });
    }
  };

  const certificate = selected ? detail.data?.certificate : null;
  const copyId = async () => {
    const copied = await copyText(certificate.publicId);
    toast({ title: copied ? "ID sertifikat disalin" : "ID belum tersalin", description: copied ? undefined : certificate.publicId });
  };

  return (
    <AdminPageFrame title="Sertifikat" description="Penerbitan sertifikat terverifikasi dan riwayat lama. Pencabutan selalu dicatat.">
      {error ? <AdminError error={error} onRetry={refetch} /> : (
        <div className={selected ? "split" : "stack gap-grid"}>
          <section className="card anim-rise" aria-labelledby="list-title">
            <h2 className="sr-only" id="list-title">Daftar sertifikat</h2>
            <div className="stack gap-3" style={{ padding: "12px var(--card-pad)" }}>
              <div className="toolbar">
                <div className="seg" role="group" aria-label="Sumber data">
                  <button type="button" aria-pressed={source === "verified"} onClick={() => { setSource("verified"); setSelected(null); }}><Ic name="shield" />Terverifikasi</button>
                  <button type="button" aria-pressed={source === "legacy"} onClick={() => { setSource("legacy"); setSelected(null); }}><Ic name="history" />Riwayat lama</button>
                </div>
                {!isLoading ? <span className="t-support t-muted t-num ml-auto" aria-live="polite">{total} sertifikat</span> : null}
              </div>
              <div className="toolbar">
                <label className="search" style={{ flex: "1 1 200px" }}>
                  <Ic name="search" size="sm" /><span className="sr-only">Cari sertifikat</span>
                  <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau ID" />
                </label>
                {source === "verified" ? (
                  <>
                    <label className="sr-only" htmlFor="f-status">Status sertifikat</label>
                    <select className="select" id="f-status" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value)}>
                      <option value="">Semua status</option><option value="issued">Diterbitkan</option><option value="revoked">Dicabut</option>
                    </select>
                  </>
                ) : null}
                <label className="sr-only" htmlFor="f-tier">Tingkat sertifikat</label>
                <select className="select" id="f-tier" style={{ width: "auto" }} value={tier} onChange={(event) => setTier(event.target.value)}>
                  <option value="">Semua tingkat</option>
                  {TIERS.map((item) => <option key={item.number} value={item.number}>Tingkat {item.number} · {item.short}</option>)}
                </select>
              </div>
            </div>
            <DataTable
              framed={false}
              className="card-sect"
              caption="Daftar sertifikat"
              responsive="stacked"
              loading={isLoading}
              rows={items}
              emptyMessage={source === "legacy" ? "Tidak ada riwayat lama." : "Belum ada sertifikat yang cocok."}
              selectedKey={selected || undefined}
              rowKey={(item) => String(item.publicId || item.id)}
              sort={{ key: "issued", direction: "desc" }}
              columns={[
                {
                  key: "learner", header: "Peserta", required: true,
                  render: (item) => (
                    <span className="row gap-3">
                      <span className="avatar avatar-sm" data-hue={AVATAR_HUES[(Number(item.learner?.id) || 0) % AVATAR_HUES.length]}>{initialsOf(item.learner?.name || item.learner?.email)}</span>
                      <span className="t-medium t-nowrap">{item.learner?.name || item.learner?.email}</span>
                    </span>
                  ),
                },
                {
                  key: "tier", header: "Tingkat",
                  render: (item) => (
                    <span className="row gap-2" data-hue={tierHue(item.tierNumber)}>
                      <span className={`medal medal-sm${item.status === "revoked" || item.classification === "legacy_unverified" ? " is-locked" : ""}`} style={{ width: 24, height: 24 }} aria-hidden="true">{item.tierNumber}</span>
                      <span className={`t-nowrap${item.status === "revoked" ? " t-muted" : ""}`}><span className="sr-only">Tingkat {item.tierNumber} · </span>{tierShort(item.tierNumber, item.tierName)}</span>
                    </span>
                  ),
                },
                { key: "issued", header: "Terbit", sortable: false, render: (item) => <span className="t-muted t-nowrap">{formatAdminDate(item.issuedAt)}</span> },
                {
                  key: "status", header: "Status",
                  render: (item) => (item.classification === "legacy_unverified"
                    ? <span className="chip chip-outline">Belum terverifikasi</span>
                    : item.status === "revoked"
                      ? <span className="chip chip-danger"><Ic name="x" />Dicabut</span>
                      : <span className="chip chip-success"><Ic name="check" />Diterbitkan</span>),
                },
                { key: "evidence", header: "Bukti", render: (item) => <span className="t-muted t-nowrap">{item.classification === "legacy_unverified" ? "—" : `${item.evidenceCount} catatan`}</span> },
                {
                  key: "open", header: <span className="sr-only">Detail</span>, align: "end", required: true,
                  render: (item) => (item.publicId ? (
                    <button type="button" className={`btn btn-ghost btn-sm btn-icon${selected === item.publicId ? "" : " btn-quiet"}`} aria-current={selected === item.publicId ? "true" : undefined} aria-label={selected === item.publicId ? `Detail sertifikat ${item.learner?.name || ""} sedang dibuka` : `Lihat detail sertifikat ${item.learner?.name || ""}`} onClick={() => setSelected(item.publicId)}>
                      <Ic name="chev-right" />
                    </button>
                  ) : null),
                },
              ]}
            />
            {!isLoading && total ? (
              <nav className="card-foot between" aria-label="Halaman daftar sertifikat">
                <span className="t-support t-muted t-num">{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} dari {total}</span>
                <div className="row gap-2">
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" disabled={page === 0} aria-label="Halaman sebelumnya" onClick={() => setPage(page - 1)}><Ic name="chev-left" /></button>
                  <button type="button" className="btn btn-secondary btn-sm btn-icon" disabled={page >= pages - 1} aria-label="Halaman berikutnya" onClick={() => setPage(page + 1)}><Ic name="chev-right" /></button>
                </div>
              </nav>
            ) : null}
          </section>

          {selected ? (
            <aside className="card anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 1, alignSelf: "start" })} id="detail" aria-labelledby="det-title">
              <div className="card-head" style={{ padding: "12px 12px 0 var(--card-pad)" }}>
                <span className="t-overline t-muted" style={{ paddingTop: 8 }}>Detail sertifikat</span>
                <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Tutup detail" onClick={() => setSelected(null)}><Ic name="x" /></button>
              </div>
              {!certificate ? (
                <div className="card-pad stack gap-3" aria-busy="true">
                  {detail.error ? <p className="t-support t-danger">{detail.error.message}</p> : <><span className="skel" style={{ height: 56 }} /><span className="skel" style={{ height: 120 }} /></>}
                </div>
              ) : (
                <>
                  <div className="card-pad stack gap-4" style={{ paddingTop: 12 }}>
                    <div className="row gap-4" data-hue={tierHue(certificate.tierNumber)}>
                      <span className={`medal${certificate.status === "revoked" ? " is-locked" : ""}`} role="img" aria-label={`Tingkat ${certificate.tierNumber}`}>{certificate.tierNumber}</span>
                      <div className="stack gap-1 grow" style={{ minWidth: 0 }}>
                        <span className="t-caption t-muted">Tingkat {certificate.tierNumber}</span>
                        <h2 className="card-title" id="det-title">{certificate.tierName}</h2>
                        <div className="row">{certificate.status === "revoked" ? <span className="chip chip-danger"><Ic name="x" />Dicabut</span> : <span className="chip chip-success"><Ic name="check" />Diterbitkan</span>}</div>
                      </div>
                    </div>
                    <dl className="dl">
                      <dt>Pemegang</dt><dd><Link className="row gap-2 justify-end" to={`/admin/learners/${certificate.learner?.id}`}><span className="avatar avatar-xs" data-hue="green">{initialsOf(certificate.learner?.name || certificate.learner?.email)}</span>{certificate.learner?.name || certificate.learner?.email}</Link></dd>
                      <dt>Terbit</dt><dd>{formatAdminDate(certificate.issuedAt)}</dd>
                      <dt>Kebijakan</dt><dd>{policyLabel(certificate.policyVersion)} · generasi {certificate.generation}</dd>
                    </dl>
                    <div className="stack gap-1-5">
                      <span className="label">ID sertifikat</span>
                      <div className="inset row gap-2" style={{ padding: "4px 4px 4px 12px" }}>
                        <code className="t-mono grow t-clamp-1">{certificate.publicId}</code>
                        <button type="button" className="btn btn-ghost btn-sm btn-icon btn-quiet" aria-label="Salin ID sertifikat" onClick={copyId}><Ic name="copy" /></button>
                      </div>
                      <div className="row"><Link className="btn btn-sm btn-link" to={`/verify-certificate/${certificate.publicId}`} target="_blank" rel="noreferrer">Buka halaman verifikasi publik<Ic name="external" size="xs" /></Link></div>
                    </div>
                  </div>
                  <section className="card-sect card-pad stack gap-3" aria-labelledby="ev-title">
                    <h3 className="t-heading" id="ev-title">Bukti ({detail.data.evidence.length})</h3>
                    <ul className="stack gap-2">
                      {detail.data.evidence.map((item, index) => (
                        <li key={index} className="row gap-2"><Ic name="check-circle" size="sm" className="t-success" /><span className="t-support">{item.moduleNumber ? `Modul ${item.moduleNumber}` : "Ujian akhir"} · {EVIDENCE_LABEL[item.type] || item.type}</span></li>
                      ))}
                    </ul>
                  </section>
                  <section className="card-sect card-pad stack gap-3" aria-labelledby="hist-title">
                    <h3 className="t-heading" id="hist-title">Riwayat</h3>
                    <ol className="stack gap-3">
                      {detail.data.events.map((event, index) => (
                        <li key={index} className="row gap-3" data-hue={event.type === "revoked" ? "rose" : "green"}>
                          <span className="tile tile-xs tile-round"><Ic name={event.type === "revoked" ? "x" : "cert"} /></span>
                          <span className="t-support"><span className="t-muted t-num">{formatAdminDate(event.createdAt)}</span> · {EVENT_LABEL[event.type] || event.type}{event.reason ? ` — ${event.reason}` : ""}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                  {certificate.status === "issued" ? (
                    <section className="card-sect card-pad stack gap-3" aria-labelledby="revoke-title">
                      <div className="row gap-2"><Ic name="alert" className="t-danger" /><h3 className="t-heading" id="revoke-title">Cabut sertifikat</h3></div>
                      <div className="field">
                        <label className="label" htmlFor="revoke-reason">Alasan pencabutan (5–500 karakter)</label>
                        <textarea id="revoke-reason" className="textarea" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
                        <p className="hint">Halaman verifikasi publik akan menampilkan status dicabut. Catatan tidak dihapus.</p>
                      </div>
                      <div className="row"><button type="button" className="btn btn-danger-soft btn-sm" disabled={reason.trim().length < 5 || revoke.isPending} onClick={() => setConfirmOpen(true)}><Ic name="x-circle" />Cabut sertifikat</button></div>
                    </section>
                  ) : (
                    <p className="card-sect card-pad t-support t-muted">Sertifikat ini sudah dicabut dan tetap tercatat.{certificate.revocationReason ? ` Alasan: ${certificate.revocationReason}` : ""}</p>
                  )}
                </>
              )}
            </aside>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon="certificate"
        title="Cabut sertifikat ini?"
        description="Sertifikat akan tampil sebagai dicabut di halaman verifikasi publik. Catatan tidak dihapus dan pencabutan tercatat di jejak audit."
        confirmLabel="Cabut sertifikat"
        cancelLabel="Batal"
        onConfirm={confirmRevoke}
      />
    </AdminPageFrame>
  );
}
