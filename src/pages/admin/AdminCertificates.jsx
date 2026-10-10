// @ts-nocheck
import React, { useState } from "react";
import { Badge, Button, ConfirmDialog, DataTable, Surface, useToast } from "@/components/primitives";
import { useAdminCertificate, useAdminCertificates, useRevokeAdminCertificate } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";

const TIERS = [1, 2, 3, 4, 5, 6];

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
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const filters = { source, ...(status ? { status } : {}), ...(tier ? { tier } : {}) };
  const { data, isLoading, error, refetch } = useAdminCertificates(filters);
  const detail = useAdminCertificate(selected);
  const revoke = useRevokeAdminCertificate();
  const items = data?.items ?? [];

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

  return (
    <AdminPageFrame title="Sertifikat" description="Penerbitan sertifikat terverifikasi dan riwayat lama. Pencabutan selalu dicatat.">
      <div className="aapm-toolbar mb-5 flex flex-wrap gap-2">
        <Button variant={source === "verified" ? "learn" : "secondary"} size="sm" onClick={() => setSource("verified")}>Terverifikasi</Button>
        <Button variant={source === "legacy" ? "learn" : "secondary"} size="sm" onClick={() => setSource("legacy")}>Riwayat lama</Button>
        {source === "verified" ? (
          <>
            <label className="sr-only" htmlFor="cert-status">Status</label>
            <select id="cert-status" className="rounded-md border px-2 py-1 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Semua status</option>
              <option value="issued">Diterbitkan</option>
              <option value="revoked">Dicabut</option>
            </select>
          </>
        ) : null}
        <label className="sr-only" htmlFor="cert-tier">Tingkat</label>
        <select id="cert-tier" className="rounded-md border px-2 py-1 text-sm" value={tier} onChange={(event) => setTier(event.target.value)}>
          <option value="">Semua tingkat</option>
          {TIERS.map((item) => <option key={item} value={item}>Tingkat {item}</option>)}
        </select>
      </div>

      {isLoading ? (
        <AdminLoading label="Memuat sertifikat…" />
      ) : error ? (
        <AdminError error={error} onRetry={refetch} />
      ) : (
        <Surface className="p-0">
          <DataTable
            caption="Daftar sertifikat"
            responsive="stacked"
            rows={items}
            rowKey={(item) => String(item.publicId || item.id)}
            columns={[
              {
                key: "learner",
                header: "Peserta",
                required: true,
                overflow: "wrap",
                render: (item) => <span className="block truncate font-semibold">{item.learner?.name || item.learner?.email}</span>,
              },
              { key: "tier", header: "Tingkat", render: (item) => item.tierName },
              { key: "issued", header: "Terbit", render: (item) => formatAdminDate(item.issuedAt) },
              {
                key: "status",
                header: "Status",
                render: (item) => (item.classification === "legacy_unverified"
                  ? <Badge variant="outline">Belum terverifikasi</Badge>
                  : <Badge variant={item.status === "revoked" ? "danger" : "success"}>{item.status === "revoked" ? "Dicabut" : "Diterbitkan"}</Badge>),
              },
              {
                key: "evidence",
                header: "Bukti",
                render: (item) => (item.classification === "legacy_unverified" ? "—" : `${item.evidenceCount} catatan`),
              },
              {
                key: "open",
                header: "",
                render: (item) => (item.publicId ? <Button variant="secondary" size="sm" onClick={() => setSelected(item.publicId)}>Detail</Button> : null),
              },
            ]}
          />
        </Surface>
      )}

      {selected && detail.data?.certificate ? (
        <Surface className="mt-6 grid gap-3 p-5" aria-label="Detail sertifikat">
          <h2 className="text-lg font-semibold">{detail.data.certificate.tierName}</h2>
          <p className="text-sm text-muted-foreground">{detail.data.certificate.learner?.email} · ID {detail.data.certificate.publicId}</p>
          <p className="text-sm">Generasi akademik: {detail.data.certificate.generation}. Kebijakan: {detail.data.certificate.policyVersion}.</p>
          <div>
            <p className="text-sm font-medium">Bukti ({detail.data.evidence.length})</p>
            <ul className="text-sm">
              {detail.data.evidence.map((item, index) => (
                <li key={index}>{item.moduleNumber ? `Modul ${item.moduleNumber}` : "Ujian akhir"} · {item.type}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Riwayat peristiwa</p>
            <ul className="text-sm">
              {detail.data.events.map((event, index) => (
                <li key={index}>{formatAdminDate(event.createdAt)} · {event.type}{event.reason ? ` — ${event.reason}` : ""}</li>
              ))}
            </ul>
          </div>
          {detail.data.certificate.status === "issued" ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="revoke-reason">Alasan pencabutan (5–500 karakter)</label>
              <textarea id="revoke-reason" className="rounded-md border p-2 text-sm" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              <div>
                <Button variant="danger-soft" disabled={reason.trim().length < 5 || revoke.isPending} onClick={() => setConfirmOpen(true)}>Cabut sertifikat</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm">Sertifikat ini sudah dicabut dan tetap tercatat.</p>
          )}
        </Surface>
      ) : null}

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
