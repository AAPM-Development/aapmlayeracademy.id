import React, { useState } from "react";
import { Link } from "react-router-dom";
import { StateView } from "@/design-system";
import { useAdminCourses } from "@/lib/useAdminData";
import { AdminError, AdminLoading, AdminPageFrame } from "@/components/admin/AdminPage";
import { formatAdminDate } from "@/components/admin/adminUtils";
import { Bar, Ic } from "@/design-system/canvas";
import { CurriculumTitle, DeleteEmptyCurriculum, NewCurriculumRow } from "@/components/admin/CurriculumManage";

const contentTools = [
  { title: "Kebijakan kurikulum", detail: "Atur persyaratan peserta", to: "/admin/curriculum/policies", ic: "route", hue: "teal" },
  { title: "Bank ujian akhir", detail: "Kelola soal ujian akhir", to: "/admin/curriculum/final-bank", ic: "exam", hue: "violet" },
  { title: "Pengaturan APPI", detail: "Bantu isi draf modul", to: "/admin/ai-settings", ic: "sparkle", hue: "ai" },
];

const moduleStatuses = [
  { key: "published", label: "Terbit", chip: "chip-success" },
  { key: "unpublished", label: "Belum terbit", chip: "chip-warning" },
  { key: "draft", label: "Draf", chip: "" },
  { key: "archived", label: "Arsip", chip: "chip-outline" },
];

const GUIDE = [
  "Perubahan materi dan bank soal disimpan sebagai draf sebelum validasi dan penerbitan.",
  "Urutan dan persyaratan akademik dikelola melalui kebijakan kurikulum.",
  "Nomor modul tampil mengikuti urutan di kurikulum; riwayat, nilai, progres, dan sertifikat peserta tetap tersimpan.",
  "Modul dari kurikulum lain tampil ke peserta setelah terbit dan dimasukkan ke kebijakan kurikulum (wajib atau pilihan).",
];

function CourseFeature({ course, index = 0 }) {
  const counts = course.lifecycleCounts || {};
  const published = Number(counts.published || 0);
  const total = Number(course.moduleCount || 0);
  const percent = total ? Math.round((published / total) * 100) : 0;
  return (
    <section className="card split-rail stretch anim-rise" data-hue={course.primary ? "blue" : ["teal", "violet", "amber", "rose", "orange"][index % 5]} style={{ gap: 0, overflow: "hidden", "--i": index }} aria-labelledby={`course-${course.id}-title`}>
      <div className="cover" style={{ borderRadius: 0, minHeight: 132 }}>
        <span className="tile tile-lg"><Ic name={course.primary ? "egg" : "layers"} /></span>
        <span className="cover-num" aria-hidden="true">{course.moduleCount}</span>
      </div>
      <div className="card-pad-lg cols-aside" style={{ gap: 24, alignItems: "stretch" }}>
        <div className="stack gap-5">
          <div className="stack gap-1">
            <span className="t-overline t-ink">{course.primary ? "Kurikulum utama" : "Kurikulum"}</span>
            <CurriculumTitle course={course} className="t-title-c" id={`course-${course.id}-title`} />
            {course.summary ? <p className="t-support t-muted t-clamp-2">{course.summary}</p> : null}
            <ul className="row wrap t-support t-muted" style={{ gap: "4px 16px" }} aria-label="Ringkasan course">
              <li className="row gap-1-5"><Ic name="book" size="sm" />{course.moduleCount} modul</li>
              <li className="row gap-1-5"><Ic name="layers" size="sm" />{course.chapterCount ?? course.curriculum?.length ?? "—"} chapter</li>
              {course.primary ? <li className="row gap-1-5"><Ic name="grad" size="sm" />{course.learnerCount} peserta</li> : null}
              {course.updatedAt ? <li className="row gap-1-5"><Ic name="clock" size="sm" />Diperbarui {formatAdminDate(course.updatedAt)}</li> : null}
            </ul>
          </div>
          <div className="row wrap gap-3 mt-auto">
            {total ? <Link className="btn btn-primary" to={`/admin/courses/${course.id}`}><Ic name="edit" />Kelola kurikulum</Link>
              : <Link className="btn btn-primary" to={`/admin/courses/${course.id}?chapter=new`}><Ic name="plus" />Tambah chapter pertama</Link>}
            {course.primary ? <Link className="btn btn-secondary" to="/modules"><Ic name="eye" />Pratinjau peserta</Link> : null}
            <DeleteEmptyCurriculum course={course} afterDelete={null} />
          </div>
        </div>
        <div className="inset stack gap-3" style={{ width: 320, maxWidth: "100%", padding: "var(--s-4)" }}>
          <div className="row between gap-3">
            <h3 className="t-support t-strong">Status modul</h3>
            <span className="t-caption t-muted t-num">{published} dari {total} terbit</span>
          </div>
          <div role="img" aria-label={`${published} dari ${total} modul terbit`}><Bar value={percent} size="sm" hue="green" /></div>
          <ul className="cols-2" style={{ gap: 8 }} aria-label="Jumlah modul per status">
            {moduleStatuses.map((status) => (
              <li key={status.key} className={`chip ${status.chip} chip-dot`}>{status.label} <span className="t-num">{counts[status.key] ?? 0}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function AdminCourses() {
  const { data, isLoading, error, refetch } = useAdminCourses();
  const [guideVisible, setGuideVisible] = useState(true);
  const courses = data?.courses || [];

  return (
    <AdminPageFrame title="Course" description="Kelola kurikulum, konten modul, dan bank soal Academy. Tambah kurikulum lain langsung di daftar ini.">
      {isLoading ? <AdminLoading label="Memuat katalog course…" /> : error ? <AdminError error={error} onRetry={refetch} /> : !courses.length ? (
        <StateView kind="empty" icon="course" title="Belum ada kurikulum" description="Kurikulum akan tersedia ketika katalog modul telah diinisialisasi." />
      ) : (
        <>
          {courses.map((course, index) => <CourseFeature key={course.id} course={course} index={index} />)}
          <NewCurriculumRow />

          <section className="alert alert-info anim-rise" style={/** @type {React.CSSProperties} */ ({ "--i": 1 })} aria-labelledby="how-title">
            <Ic name="info" />
            <div className="stack gap-2 grow">
              <div className="row between gap-3">
                <h2 className="alert-title t-body" id="how-title">Cara kerja draf &amp; penerbitan</h2>
                <button type="button" className="btn btn-sm btn-link" aria-expanded={guideVisible} aria-controls="how-list" onClick={() => setGuideVisible((value) => !value)}>
                  {guideVisible ? "Sembunyikan" : "Tampilkan"}<Ic name={guideVisible ? "chev-up" : "chev-down"} />
                </button>
              </div>
              {guideVisible ? (
                <ul className="stack gap-1-5" id="how-list">
                  {GUIDE.map((line) => (
                    <li key={line} className="row-start gap-2"><span className="row none" style={{ height: 20 }}><Ic name="check" size="xs" className="t-muted" /></span><span>{line}</span></li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <section className="stack gap-4" aria-labelledby="tools-title">
            <div className="sh">
              <div className="stack gap-0-5">
                <h2 className="sh-title" id="tools-title">Alat konten</h2>
                <p className="sh-desc">Persyaratan, soal akhir, dan asisten draf untuk course ini.</p>
              </div>
            </div>
            <div className="grid-md">
              {contentTools.map((tool, index) => (
                <Link key={tool.title} className="card card-tactile card-pad row gap-4 anim-rise" to={tool.to} data-hue={tool.hue} style={/** @type {React.CSSProperties} */ ({ "--i": index + 2 })}>
                  <span className="tile"><Ic name={tool.ic} /></span>
                  <div className="stack gap-0-5 grow" style={{ minWidth: 0 }}>
                    <h3 className="t-heading t-clamp-1">{tool.title}</h3>
                    <span className="t-support t-muted t-clamp-1">{tool.detail}</span>
                  </div>
                  <Ic name="chev-right" className="t-muted" />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </AdminPageFrame>
  );
}
