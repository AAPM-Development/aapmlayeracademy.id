import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "@/design-system/patterns/AppShell";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, useToast } from "@/components/primitives";
import { useCertificates, useCertificationEligibility, useClaimCertificate, useModules, useUserProgress } from "@/lib/useCourseData";
import { getNextModule } from "@/lib/academyData";
import { newRequestKey } from "@/api/nativeClient";
import { downloadCertificateImage, downloadVerifiedCertificatePdf } from "@/lib/certificatePdf";
import { copyText } from "@/lib/clipboard";
import { celebrate } from "@/lib/celebrate";
import AppiMascot, { appiAsset } from "@/components/appi/AppiMascot";
import { CertificatePreview } from "@/components/certificate/CertificateDocument";
import { Bar, Ic } from "@/design-system/canvas";
import { moduleNo } from "@/lib/moduleNumber";

// Canvas tier hues, in tier order.
const TIER_HUES = ["green", "teal", "blue", "violet", "rose", "gold"];
const hueOf = (tierNumber) => TIER_HUES[(Number(tierNumber) - 1) % TIER_HUES.length] || "green";

function formatDay(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function verificationPath(certificate) {
  const url = certificate?.verificationUrl;
  if (!url) return certificate?.publicId ? `/verify-certificate/${certificate.publicId}` : "";
  try { return new URL(url).pathname; } catch { return url; }
}

const percentOf = (tier) => (tier.totalRequiredModules ? Math.round((tier.completedRequiredModules / tier.totalRequiredModules) * 100) : 0);
const isColoured = (tier) => tier.status !== "locked";

/** The tier the learner is closest to: claimable first, then fewest missing modules. */
function focusTier(tiers) {
  const eligible = tiers.find((tier) => tier.status === "eligible");
  if (eligible) return eligible;
  const running = tiers.filter((tier) => tier.status === "in_progress").sort((a, b) => a.missingModuleNumbers.length - b.missingModuleNumbers.length);
  return running[0] || tiers.find((tier) => tier.status === "locked") || null;
}

function tierChip(tier) {
  switch (tier.status) {
    case "issued": return <span className="chip chip-success"><Ic name="check" />Dimiliki</span>;
    case "revoked": return <span className="chip chip-danger"><Ic name="alert" />Dicabut</span>;
    case "eligible": return <span className="chip chip-gold"><Ic name="award" />Siap diklaim</span>;
    case "in_progress": return <span className="chip chip-ai chip-dot">Sedang berjalan</span>;
    default: return <span className="chip">Belum dimulai</span>;
  }
}

const STATUS_SR = { issued: "dimiliki", revoked: "dicabut", eligible: "siap diklaim", in_progress: "sedang berjalan", locked: "belum dimulai" };

function Medal({ tier, small = false, pulse = false, index = undefined }) {
  const owned = tier.status === "issued";
  return (
    <span
      className={["medal", small && "medal-sm", !isColoured(tier) && "is-locked", index !== undefined && "anim-pop", pulse && "anim-pulse"].filter(Boolean).join(" ")}
      style={index ? /** @type {React.CSSProperties} */ ({ "--i": index }) : undefined}
      aria-hidden="true"
    >
      {isColoured(tier) ? tier.tierNumber : <span className="t-ink">{tier.tierNumber}</span>}
      {owned && !small ? <span className="medal-badge"><Ic name="check" /></span> : null}
    </span>
  );
}

/** Hero: six medals joined by progress rails, with APPI cheering the nearest tier. */
function CertificationHero({ tiers, focus }) {
  const issued = tiers.filter((tier) => tier.status === "issued").length;
  const total = tiers.length || 6;
  const missing = focus?.missingModuleNumbers ?? [];
  const finalOnly = focus && !missing.length && focus.requiresFinal && !focus.finalPassed;
  const coach = !focus
    ? { mood: "proud", line: <>Semua tingkat sudah Anda raih. <strong>Luar biasa!</strong></> }
    : focus.status === "eligible"
      ? { mood: "cheer", line: <><strong>Tingkat {focus.tierNumber}</strong> siap diklaim. Ayo ambil!</> }
      : finalOnly
        ? { mood: "happy", line: <>Tinggal ujian akhir untuk <strong>Tingkat {focus.tierNumber}</strong>!</> }
        : missing.length === 1
          ? { mood: "proud", line: <>Tinggal satu modul lagi untuk <strong>Tingkat {focus.tierNumber}</strong>!</> }
          : { mood: issued ? "happy" : "wink", line: <>{missing.length} modul lagi untuk <strong>Tingkat {focus.tierNumber}</strong>. Pelan-pelan saja!</> };
  const next = !focus ? (
    <>Seluruh <strong>{total} tingkat</strong> sudah tercapai.</>
  ) : focus.status === "eligible" ? (
    <>Klaim sertifikat <strong>Tingkat {focus.tierNumber}</strong> di bawah.</>
  ) : finalOnly ? (
    <>Lulus <strong>ujian akhir</strong> untuk membuka Tingkat {focus.tierNumber}.</>
  ) : (
    <>Selesaikan <strong>Modul {missing[0]}</strong> untuk membuka Tingkat {focus.tierNumber}.</>
  );

  return (
    <section className="card card-fill feature cols-aside anim-rise" data-hue={focus ? hueOf(focus.tierNumber) : "gold"} aria-labelledby="hero-title" style={{ padding: "28px 32px", overflow: "hidden" }}>
      <div className="stack gap-5">
        <div className="stack gap-1">
          <span className="t-overline t-ink">Sertifikasi Academy</span>
          <h2 className="t-display" id="hero-title">{issued} dari {total} tingkat diraih</h2>
        </div>
        <div className="scroll-x pulse-room">
          <ol className="row items-start" style={{ minWidth: 540 }} aria-label="Jalur enam tingkat sertifikasi">
            {tiers.map((tier, index) => {
              const last = index === tiers.length - 1;
              const current = focus?.tierNumber === tier.tierNumber;
              const label = (
                <span className="stack items-center gap-2">
                  <Medal tier={tier} index={index} pulse={current && tier.status !== "issued"} />
                  <span className={`t-caption t-nowrap ${tier.status === "locked" ? "t-muted" : "t-strong"}${current ? " t-ai" : ""}`}>
                    Tingkat {tier.tierNumber}<span className="sr-only">: {STATUS_SR[tier.status] || "belum dimulai"}</span>
                  </span>
                </span>
              );
              if (last) {
                return <li key={tier.tierNumber} className="stack items-center gap-2 none" data-hue={hueOf(tier.tierNumber)} aria-current={current ? "step" : undefined}>{label}</li>;
              }
              const fill = tier.status === "issued" ? 100 : 0;
              return (
                <li key={tier.tierNumber} className="row items-start gap-2" style={{ flex: "1 1 0" }} data-hue={hueOf(tier.tierNumber)} aria-current={current ? "step" : undefined}>
                  {label}
                  <span className="grow" style={{ display: "grid", alignItems: "center", height: 56, padding: "0 4px" }} aria-hidden="true">
                    <Bar value={fill} size="sm" hue={fill ? hueOf(tier.tierNumber) : undefined} animate={Boolean(fill)} style={{ height: 4 }} />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="t-body">{next}</p>
      </div>
      <div className="stack items-center gap-4 hide-sm" style={{ width: 250 }}>
        <p className="bubble tail-down appi-say">{coach.line}</p>
        <div className="appi-stage" style={{ marginTop: 6 }}>
          <AppiMascot mood={coach.mood} size="hero" enter="pop" />
          <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={{ right: -18, top: 4, width: 30 }} />
          <img className="sparkle anim-twinkle" src={appiAsset(13)} alt="" style={/** @type {React.CSSProperties} */ ({ left: -14, top: 40, width: 18, "--i": 2 })} />
        </div>
      </div>
    </section>
  );
}

function TierCard({ tier, index, nextModuleNumber, onClaim, pending, onOpen, shownNumber = (number) => number }) {
  const status = tier.status;
  const required = tier.requiredModules?.length ? tier.requiredModules : tier.missingModuleNumbers;
  const missing = new Set(tier.missingModuleNumbers);
  const percent = percentOf(tier);
  const finalOnly = tier.requiresFinal && !missing.size && !tier.finalPassed;
  const legacyCount = tier.legacyRecords?.length || 0;

  let note;
  let action;
  if (status === "issued") {
    note = <><Ic name="calendar" size="xs" />Diterbitkan {formatDay(tier.existingCertificate?.issuedAt)}</>;
    action = <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpen(tier.existingCertificate)}><Ic name="cert" />Lihat sertifikat</button>;
  } else if (status === "revoked") {
    note = <><Ic name="alert" size="xs" />Dicabut pengelola Academy dan tidak lagi berlaku</>;
  } else if (status === "eligible") {
    if (tier.emailVerificationRequired) {
      note = <><Ic name="mail" size="xs" />Verifikasi email sebelum mengklaim</>;
      action = <Link className="btn btn-learn btn-sm" to="/profile/settings">Verifikasi email dulu<Ic name="arrow-right" /></Link>;
    } else {
      note = <><Ic name="check-circle" size="xs" />Semua syarat terpenuhi</>;
      action = (
        <button type="button" className="btn btn-learn btn-sm" disabled={pending} aria-busy={pending || undefined} onClick={() => onClaim(tier.tierNumber)}>
          {pending ? <span className="typing" aria-hidden="true"><i /><i /><i /></span> : <Ic name="award" />}Klaim sertifikat
        </button>
      );
    }
  } else if (status === "in_progress") {
    if (finalOnly) {
      note = <><Ic name="exam" size="xs" />Tinggal ujian akhir ≥ 80%</>;
      action = <Link className="btn btn-learn btn-sm" to="/final-exam"><Ic name="exam" />Ikuti ujian akhir</Link>;
    } else {
      const target = missing.has(nextModuleNumber) ? nextModuleNumber : tier.missingModuleNumbers[0];
      note = <><Ic name="target" size="xs" />Masih perlu {missing.size} modul</>;
      action = <Link className="btn btn-learn btn-sm" to={`/modules/${target}`}>Lanjutkan Modul {shownNumber(target)}<Ic name="arrow-right" /></Link>;
    }
  } else if (tier.requiresFinal) {
    note = <><Ic name="exam" size="xs" />Seluruh modul + ujian akhir ≥ 80%</>;
    action = <Link className="btn btn-ghost btn-sm" to="/final-exam">Lihat ujian akhir<Ic name="chev-right" /></Link>;
  } else {
    note = <><Ic name="route" size="xs" />Bisa dimulai kapan saja</>;
    action = <Link className="btn btn-ghost btn-sm" to={`/modules/${tier.missingModuleNumbers[0] ?? ""}`}>Lihat modul wajib<Ic name="chev-right" /></Link>;
  }

  return (
    <article className="card card-tactile card-pad stack gap-4 anim-rise" data-hue={hueOf(tier.tierNumber)} style={/** @type {React.CSSProperties} */ ({ "--i": index + 1 })} aria-labelledby={`t${tier.tierNumber}-title`}>
      <div className="row between items-start gap-3">
        <Medal tier={tier} />
        {tierChip(tier)}
      </div>
      <div className="stack gap-0-5">
        <span className="t-overline t-ink">Tingkat {tier.tierNumber}{tier.requiresFinal ? " · Ujian akhir" : ""}</span>
        <h3 className="card-title" id={`t${tier.tierNumber}-title`}>{tier.tierName}</h3>
      </div>
      <div className="stack gap-2">
        <span className="t-support t-strong t-num">{tier.completedRequiredModules}/{tier.totalRequiredModules} modul wajib</span>
        <Bar value={percent} animate={percent > 0} index={index} label={`Progres ${tier.tierName}`} />
      </div>
      <ul className="row wrap gap-1-5" aria-label={tier.requiresFinal ? `Syarat Tingkat ${tier.tierNumber}` : `Modul wajib Tingkat ${tier.tierNumber}`}>
        {required.map((moduleNumber) => {
          const done = !missing.has(moduleNumber);
          const current = !done && moduleNumber === nextModuleNumber && status === "in_progress";
          return (
            <li key={moduleNumber} className={`egg egg-xs${done ? " is-done" : current ? " is-current" : ""}`} aria-current={current ? "step" : undefined}>
              {shownNumber(moduleNumber)}
              {done ? <span className="sr-only">, selesai</span> : current ? <span className="sr-only">, sedang dipelajari</span> : null}
            </li>
          );
        })}
        {tier.requiresFinal ? (
          <li className="row"><span className={`chip ${tier.finalPassed ? "chip-success" : "chip-outline"}`}><Ic name={tier.finalPassed ? "check" : "exam"} />Ujian akhir ≥ 80%</span></li>
        ) : null}
      </ul>
      <div className="stack gap-3 mt-auto">
        <p className="note row gap-1-5">{note}</p>
        {legacyCount ? <p className="note">Riwayat lama: {legacyCount} catatan belum terverifikasi dan tidak dihitung.</p> : null}
        {action ? <div className="row">{action}</div> : null}
      </div>
    </article>
  );
}

/** Thumbnail of the print document: fixed light palette, never follows dark mode. */
function MiniCertificate({ certificate, onOpen }) {
  const line = (style) => <span style={{ display: "block", borderRadius: "var(--r-pill)", ...style }} />;
  return (
    <button
      type="button"
      className="card card-link aapm"
      data-theme="light"
      onClick={() => onOpen(certificate)}
      aria-label={`Buka sertifikat ${certificate.tierName}`}
      style={{ display: "block", width: 200, aspectRatio: "1123 / 794", padding: 4, background: "var(--surface)", flex: "none", textAlign: "left" }}
    >
      <span style={{ display: "grid", gridTemplateColumns: "30% minmax(0, 1fr)", height: "100%", border: "2px solid var(--h)", borderRadius: "var(--r-xs)", overflow: "hidden" }} aria-hidden="true">
        <span style={{ display: "grid", placeItems: "center", background: "var(--h-soft)" }}><span className="medal medal-sm">{certificate.tierNumber}</span></span>
        <span className="stack gap-1-5" style={{ padding: "10px 10px 8px" }}>
          {line({ width: "40%", height: 6, background: "var(--surface-3)" })}
          {line({ width: "72%", height: 4, background: "var(--border-strong)" })}
          {line({ width: "64%", height: 8, background: "var(--fg)" })}
          {line({ width: "52%", height: 5, background: "var(--h)" })}
          <span className="row between items-end mt-auto">
            <span className="stack gap-1" style={{ width: "40%" }}>
              {line({ height: 3, background: "var(--border-strong)" })}
              {line({ width: "70%", height: 3, background: "var(--border-strong)" })}
            </span>
            <span className="inset" style={{ display: "block", width: 20, height: 20, borderRadius: 3, border: "1px dashed var(--border-strong)" }} />
          </span>
        </span>
      </span>
    </button>
  );
}

function OwnedCertificate({ certificate, index, onOpen, onPdf, onPng, onCopy, busy }) {
  return (
    <article className="card card-pad row wrap gap-5 anim-rise" data-hue={hueOf(certificate.tierNumber)} style={/** @type {React.CSSProperties} */ ({ "--i": index + 7 })} aria-labelledby={`own-${certificate.publicId || certificate.id}-title`}>
      <MiniCertificate certificate={certificate} onOpen={onOpen} />
      <div className="stack gap-4 grow" style={{ flex: "1 1 220px" }}>
        <div className="stack gap-1">
          <span className="t-overline t-ink">Tingkat {certificate.tierNumber}</span>
          <h3 className="card-title" id={`own-${certificate.publicId || certificate.id}-title`}>{certificate.tierName}</h3>
          <span className="t-support t-success row gap-1-5"><Ic name="check-circle" size="sm" />Terverifikasi · {formatDay(certificate.issuedAt)}</span>
        </div>
        <div className="row wrap gap-2 mt-auto">
          <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)} aria-busy={busy === "pdf" || undefined} onClick={() => onPdf(certificate)}><Ic name="download" />PDF</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} aria-busy={busy === "png" || undefined} onClick={() => onPng(certificate)}>PNG</button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Salin tautan verifikasi" onClick={() => onCopy(certificate)}><Ic name="link" /></button>
        </div>
      </div>
    </article>
  );
}

export default function Certification() {
  const { data: eligibility, isLoading } = useCertificationEligibility();
  const { data: certificates = [] } = useCertificates();
  const { data: modules = [] } = useModules();
  const { data: progress = [] } = useUserProgress();
  const claim = useClaimCertificate();
  const { toast } = useToast();
  const [pendingTier, setPendingTier] = useState(null);
  const [busy, setBusy] = useState({ id: null, kind: null });
  const [viewing, setViewing] = useState(null);
  // One key per tier until the server answers, so a retry after a lost response cannot issue twice.
  const keys = useRef({});

  const tiers = eligibility?.tiers ?? [];
  const focus = focusTier(tiers);
  const nextModuleNumber = getNextModule(modules, progress)?.moduleNumber;
  // Tiers list module ids; show each module's position number instead.
  const shownNumber = (number) => moduleNo(modules.find((module) => module.moduleNumber === number)) ?? number;
  const verifiedCertificates = certificates.filter((item) => item.source !== "legacy_unverified" && item.status !== "revoked");
  const legacyCertificates = certificates.filter((item) => item.source === "legacy_unverified");
  const nextUnclaimed = tiers.find((tier) => tier.status !== "issued");

  const onClaim = async (tierNumber) => {
    keys.current[tierNumber] ??= newRequestKey();
    setPendingTier(tierNumber);
    try {
      const reply = await claim.mutateAsync({ tierNumber, requestKey: keys.current[tierNumber] });
      delete keys.current[tierNumber];
      if (reply.created) celebrate("milestone");
      setViewing(reply.certificate);
      toast({
        title: reply.created ? "Sertifikat diterbitkan" : "Sertifikat sudah tersedia",
        description: `${reply.certificate.tierName} siap diunduh dan diverifikasi.`,
      });
    } catch (error) {
      // A server refusal ends the attempt. A lost response keeps the key so a retry is idempotent.
      if (error?.status) delete keys.current[tierNumber];
      toast({ variant: "destructive", title: "Sertifikat belum diterbitkan", description: error?.message || "Periksa koneksi lalu coba lagi." });
    } finally {
      setPendingTier(null);
    }
  };

  const exportAs = async (certificate, kind) => {
    setBusy({ id: certificate?.publicId, kind });
    try {
      if (kind === "png") await downloadCertificateImage(certificate);
      else await downloadVerifiedCertificatePdf(certificate);
    } catch (error) {
      toast({ variant: "destructive", title: "Sertifikat belum dapat diunduh", description: error?.message || "Coba lagi." });
    } finally {
      setBusy({ id: null, kind: null });
    }
  };

  const copyLink = async (certificate) => {
    const url = certificate?.verificationUrl || `${window.location.origin}${verificationPath(certificate)}`;
    const copied = await copyText(url);
    toast({ title: copied ? "Tautan verifikasi disalin" : "Tautan belum tersalin", description: copied ? "Bagikan ke atasan atau HR untuk memeriksa keaslian." : url });
  };

  const busyFor = (certificate) => (busy.id === certificate?.publicId ? busy.kind : null);

  return (
    <Page>
      <header className="ph">
        <div className="ph-copy">
          <h1 className="ph-title">Sertifikasi</h1>
          <p className="ph-desc">Sertifikat diterbitkan server setelah persyaratan belajar dan penilaian terverifikasi, lengkap dengan kode QR untuk diperiksa siapa pun.</p>
        </div>
      </header>

      {isLoading && !tiers.length ? (
        <div className="card card-fill feature card-pad stack gap-4" aria-busy="true">
          <span className="skel" style={{ width: 160, height: 14 }} />
          <span className="skel" style={{ width: "60%", height: 34 }} />
          <span className="skel" style={{ width: "100%", height: 56 }} />
        </div>
      ) : (
        <CertificationHero tiers={tiers} focus={focus} />
      )}

      <section className="stack gap-4" aria-labelledby="tiers-title">
        <div className="sh">
          <div className="stack gap-1">
            <h2 className="sh-title" id="tiers-title">Tingkat sertifikasi</h2>
            <p className="sh-desc">Setiap tingkat memerlukan modul wajibnya sendiri. Kurikulum terbuka, jadi tingkat bisa dikejar dalam urutan apa pun.</p>
          </div>
        </div>
        <div className="grid-lg">
          {tiers.map((tier, index) => (
            <TierCard
              key={tier.tierNumber}
              tier={tier}
              index={index}
              nextModuleNumber={nextModuleNumber}
              shownNumber={shownNumber}
              onClaim={onClaim}
              pending={pendingTier === tier.tierNumber}
              onOpen={setViewing}
            />
          ))}
        </div>
      </section>

      <section className="stack gap-4" aria-labelledby="mine-title">
        <div className="sh">
          <div className="stack gap-1">
            <h2 className="sh-title" id="mine-title">Sertifikat saya</h2>
            <p className="sh-desc">Unduh PDF untuk dicetak atau PNG untuk dibagikan.</p>
          </div>
        </div>
        <div className="grid-lg">
          {verifiedCertificates.map((certificate, index) => (
            <OwnedCertificate
              key={certificate.publicId || certificate.id}
              certificate={certificate}
              index={index}
              onOpen={setViewing}
              onPdf={(item) => exportAs(item, "pdf")}
              onPng={(item) => exportAs(item, "png")}
              onCopy={copyLink}
              busy={busyFor(certificate)}
            />
          ))}
          {nextUnclaimed ? (
            <div className="card card-dashed card-pad stack items-center justify-center gap-3 t-center anim-rise" data-hue={hueOf(nextUnclaimed.tierNumber)} style={/** @type {React.CSSProperties} */ ({ "--i": verifiedCertificates.length + 7, minHeight: 172 })}>
              <span className="medal medal-sm is-locked" aria-hidden="true"><span className="t-ink">{nextUnclaimed.tierNumber}</span></span>
              <p className="t-support t-muted" style={{ maxWidth: "32ch" }}>
                {verifiedCertificates.length ? `Tingkat ${nextUnclaimed.tierNumber} akan muncul di sini setelah diklaim.` : "Belum ada sertifikat terverifikasi. Sertifikat pertama muncul di sini setelah diklaim."}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {legacyCertificates.length ? (
        <section className="stack gap-4" aria-labelledby="legacy-title">
          <div className="sh">
            <div className="stack gap-1">
              <h2 className="sh-title" id="legacy-title">Riwayat lama</h2>
              <p className="sh-desc">Catatan dari sistem sebelumnya. Tidak dihitung sebagai sertifikat terverifikasi dan tidak dapat diunduh.</p>
            </div>
          </div>
          <ul className="card list">
            {legacyCertificates.map((certificate) => (
              <li key={`legacy-${certificate.id}`} className="li">
                <span className="tile tile-sm"><Ic name="cert" /></span>
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <span className="li-title t-clamp-1">{certificate.tierName}</span>
                  <span className="li-meta">Belum terverifikasi · {formatDay(certificate.issuedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent size="xl">
          <div className="stack gap-1 dialog-head">
            <DialogTitle>{viewing?.tierName}</DialogTitle>
            <DialogDescription>Diterbitkan {formatDay(viewing?.issuedAt)} · dapat diverifikasi lewat kode QR.</DialogDescription>
          </div>
          {viewing ? <CertificatePreview certificate={viewing} className="cert-dialog-doc" /> : null}
          <DialogFooter>
            {verificationPath(viewing) ? <Link className="btn btn-ghost" to={verificationPath(viewing)}><Ic name="shield" />Halaman verifikasi</Link> : null}
            <button type="button" className="btn btn-ghost" onClick={() => copyLink(viewing)}><Ic name="link" />Salin tautan</button>
            <button type="button" className="btn btn-secondary" disabled={Boolean(busyFor(viewing))} onClick={() => exportAs(viewing, "png")}>Unduh PNG</button>
            <button type="button" className="btn btn-primary" disabled={Boolean(busyFor(viewing))} onClick={() => exportAs(viewing, "pdf")}><Ic name="download" />Unduh PDF</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
