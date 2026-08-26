# APPI Knowledge Governance Contract

**Status:** Proposed integration contract  
**Version:** 1.0  
**Date:** 2026-08-26  
**Owner:** AAPM Layer Academy  

## 1. Tujuan

Kontrak ini mendefinisikan cara APPI menggunakan knowledge AAPM, farm, dan
poultry secara terukur, dapat diaudit, dan sesuai identitas pengguna. Kontrak
ini adalah boundary integrasi di Layer Academy; bukan pengganti governance
yang sudah berlaku di `Workflow_Governance` atau repository lain.

## 2. Prinsip non-destruktif

Aturan berikut wajib dipenuhi oleh setiap implementasi:

1. Tidak menghapus, memindahkan, me-rename, atau menimpa dokumen governance
   existing.
2. Tidak mengubah arti atau authority dokumen existing hanya karena dokumen
   tersebut akan diindeks APPI.
3. Metadata APPI bersifat extension. Dokumen lama yang belum memiliki metadata
   tidak boleh dianggap customer-safe secara otomatis.
4. Registry baru menunjuk source existing melalui path, repository, ref, dan
   commit; registry tidak menyalin atau menggantikan source tersebut.
5. Sinkronisasi source harus snapshot/versioned. APPI tidak meminta branch
   GitHub live pada setiap chat.
6. Perubahan pada governance source tetap mengikuti workflow dan approval
   repository asalnya.

Jika terjadi konflik antara kontrak ini dan governance source, kontrak ini
tidak boleh dipakai untuk mengubah governance source. Konflik harus dicatat
sebagai review item dan diputuskan oleh owner yang berwenang.

## 3. Tiga konteks APPI

Satu intelligence core digunakan dengan policy yang berbeda:

| Konteks | Pengguna utama | Kapabilitas |
| --- | --- | --- |
| Learner / external assistant | learner terautentikasi | menjawab pembelajaran dan konteks akun yang diizinkan |
| Internal assistant | staf dengan role yang sesuai | membantu analisis operational/internal sesuai ACL |
| Admin copilot | admin dengan capability sesuai | membuat draft course, lesson, quiz, metadata, dan review |

Admin tidak otomatis memiliki akses ke seluruh knowledge. `academy_admin`,
`knowledge_admin`, `farm_admin`, `ai_admin`, dan `super_admin` adalah capability
yang terpisah dan harus dievaluasi oleh policy.

## 4. Audience scope dan default

`domain` menjelaskan isi knowledge; `audience_scope` menjelaskan siapa yang
boleh menerima isi tersebut. Domain tidak pernah menjadi permission.

| Scope | Arti |
| --- | --- |
| `public` | dapat digunakan tanpa login |
| `customer` | learner/customer authenticated |
| `internal` | staf atau role internal yang diizinkan |
| `restricted` | hanya role yang tercantum pada `allowed_roles` |

Default yang aman:

- metadata tidak lengkap → `internal`, `external_safe: false`,
  `external_review_status: review_required`;
- status selain `active` → tidak masuk retrieval default;
- dokumen development, handoff, incident, dan evidence → internal/restricted
  sampai direview;
- knowledge customer/public hanya boleh dipakai jika source atau reviewer
  menyatakannya secara eksplisit.

## 5. Knowledge record minimum

Setiap object atau chunk yang masuk ke Knowledge Store harus dapat dilacak ke
record induk dengan field berikut:

```json
{
  "knowledge_id": "AK-FM-SOP-001",
  "source": {
    "source_id": "workflow-governance",
    "repository": "erp-aapm/Workflow_Governance",
    "path": "Modules/FarmMonitoring/IMPLEMENTATION_CONTEXT.md",
    "ref": "approved-ref",
    "commit_sha": "..."
  },
  "domain": "aapm",
  "category": "farm-monitoring",
  "title": "Farm Monitoring Implementation Context",
  "authority": "module_canonical",
  "audience_scope": "internal",
  "allowed_roles": [],
  "external_safe": false,
  "external_review_status": "not_reviewed",
  "status": "active",
  "owner": "farm-monitoring",
  "effective_from": "2026-08-26",
  "supersedes": null
}
```

`commit_sha`, source path, dan snapshot time wajib disimpan untuk source Git.
Untuk runtime farm data, simpan identifier periode/record API yang dipakai,
bukan hanya hasil angka yang sudah diringkas.

## 6. Metadata tanpa mengubah dokumen existing

Dokumen baru boleh menggunakan frontmatter, tetapi dokumen existing tidak
wajib diedit. Untuk source lama, metadata dapat disimpan di sidecar registry.

Contoh frontmatter untuk dokumen baru:

```yaml
knowledge:
  enabled: true
  domain: aapm
  category: farm-monitoring
  authority: module_canonical
  audience_scope: internal
  external_safe: false
  external_review_status: not_reviewed
  owner: farm-monitoring
  status: active
```

Metadata hanya memberi deklarasi awal. Ingestion harus memvalidasi field,
mencatat warning, dan menerapkan default aman jika deklarasi tidak lengkap.

## 7. Source registry

`Workflow_Governance` dapat menjadi canonical source untuk AAPM knowledge,
tetapi hanya artifact yang terdaftar dan aktif yang boleh diindeks. Registry
harus mendukung:

- source ID yang stabil;
- repository dan ref/snapshot policy;
- include/exclude path;
- default audience dan authority;
- owner dan review status;
- provenance commit SHA;
- `enabled: false` sampai connector dan approval siap.

Registry tidak menjadi vector database. Alur yang diharapkan:

```text
Governance source
  -> versioned snapshot
  -> metadata validation
  -> chunk + provenance
  -> Knowledge Store / index
  -> ACL-filtered retrieval
  -> APPI context
```

Source registry pada repository Layer Academy hanya mendeskripsikan kontrak
dan format. Credential GitHub, token, endpoint private, dan API key tidak
boleh disimpan di repository.

## 8. Retrieval dan ACL enforcement

ACL harus diterapkan sebelum hasil retrieval diberikan kepada model:

```text
Identity
  -> role/capability
  -> audience policy
  -> source status/version
  -> search
  -> ACL filter
  -> permitted chunks only
  -> prompt/context builder
  -> LLM
```

Hal-hal berikut dilarang:

- retrieve semua knowledge lalu meminta LLM menyembunyikan yang confidential;
- menganggap prompt system sebagai satu-satunya access control;
- memakai conversation memory untuk melewati ACL current user;
- menggabungkan data runtime farm milik akun lain.

Policy minimal:

```text
learner/customer: public + customer
internal role:    public + customer + internal
restricted:       hanya jika allowed_roles berisi current role/capability
```

Jika tidak ada hasil yang diizinkan, APPI harus mengatakan bahwa informasi
tersebut tidak tersedia untuk konteks akun itu; jangan membocorkan judul,
path, atau potongan source yang ditolak.

## 9. Prioritas source dan runtime context

Untuk pertanyaan operasional, prioritas default adalah:

1. verified runtime data dari ERP/Farm Monitoring;
2. AAPM canonical knowledge dari governance source;
3. approved farm knowledge;
4. curated poultry reference;
5. account conversation memory;
6. model knowledge;
7. web, hanya jika user mengaktifkan pencarian dan policy mengizinkan.

Runtime data dan stable knowledge adalah dua sumber berbeda. Angka HDP hari
ini, suhu, mortality, atau feed intake harus berasal dari runtime context dan
selalu menyertakan periode/identitas record yang terbaca.

## 10. Lineage dan publication gate

Setiap output generated yang berpotensi menjadi lesson, quiz, assessment, atau
artikel harus menyimpan lineage source. Minimal lineage mencatat:

- knowledge ID;
- source snapshot/commit;
- authority dan audience source;
- model/provider;
- actor yang meminta generate;
- waktu generate;
- status review.

Flow wajib:

```text
AI generate
  -> draft
  -> lineage check
  -> admin review
  -> approve / revise / reject
  -> publish
```

Jika lineage mengandung source `internal` atau `restricted`, publikasi ke
customer harus diblokir sampai dependency tersebut dihapus atau melewati
external review eksplisit. Parafrase tetap dianggap dependency.

`external_review_status` menggunakan:

```text
not_reviewed | review_required | approved | rejected
```

`external_safe: true` hanya efektif jika review status `approved` dan source
masih `active`.

## 11. APPI Admin Copilot dan tool boundary

APPI Admin dapat membantu authoring, tetapi tool dibagi menjadi dua kelas:

### Read / recommend

- `getCourse`
- `getModule`
- `getLesson`
- `searchKnowledge`
- `checkCurriculumCoverage`
- `findKnowledgeConflict`
- `suggestKnowledgeMetadata`
- `summarizeLearnerProgress`

### Draft mutation, selalu memerlukan review

- `createLessonDraft`
- `updateLessonDraft`
- `generateQuizDraft`
- `suggestPublicationReview`

Tool tidak boleh auto-publish lesson, mengubah audience menjadi external, atau
mengubah role user tanpa capability dan human confirmation yang sesuai.

## 12. Implementasi bertahap yang aman

Urutan implementasi tanpa migrasi destruktif:

1. Simpan kontrak dan contoh registry (read-only, belum mengaktifkan connector).
2. Daftarkan source melalui sidecar manifest tanpa mengedit dokumen lama.
3. Tambahkan snapshot/version/provenance store.
4. Tambahkan ingestion dry-run dan report artifact yang ditolak.
5. Tambahkan ACL-filtered retrieval sebelum integrasi ke APPI.
6. Tambahkan account/runtime context sesuai policy.
7. Tambahkan Admin Copilot berbasis draft dan human review.
8. Tambahkan publication gate dan evaluation/audit log.

Setiap tahap harus bisa di-rollback dengan menonaktifkan source registry atau
feature flag. Tidak ada tahap yang menghapus knowledge existing.

## 13. Acceptance criteria kontrak

Implementasi dianggap sesuai apabila:

- source existing tetap byte-for-byte tidak berubah kecuali owner repository
  asal memang mengubahnya;
- chunk dapat dilacak ke repository/path/ref/commit;
- request learner tidak pernah menerima chunk internal/restricted;
- missing metadata menghasilkan safe default;
- output course/lesson/quiz menyimpan lineage;
- publish customer menolak dependency internal/restricted;
- tool mutation selalu menghasilkan draft/review state;
- audit dapat menjawab siapa, kapan, provider/model apa, dan source apa yang
  dipakai;
- connector dapat dimatikan tanpa mengganggu chat dan course existing.

## 14. Status implementasi di repository ini

Dokumen ini dan contoh registry adalah fondasi kontrak, bukan klaim bahwa
connector `Workflow_Governance`, Knowledge Store, atau ACL retrieval sudah
aktif di production. Endpoint dan schema runtime harus ditambahkan pada tahap
implementasi berikutnya setelah kontrak ini direview dan disetujui.
