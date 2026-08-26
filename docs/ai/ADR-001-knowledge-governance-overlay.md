# ADR-001: Add APPI knowledge governance as a non-destructive overlay

**Status:** Proposed  
**Date:** 2026-08-26  
**Deciders:** AAPM product owner, governance owner, Academy administrator  

## Context

APPI akan dipakai di learner shell, internal workflow, dan admin copilot.
Sumber utama AAPM knowledge dapat berasal dari `Workflow_Governance`, farm
runtime, dan curated poultry references. Governance source yang sudah ada
harus tetap utuh dan tetap dikelola oleh repository owner-nya.

Risiko utamanya adalah menjadikan domain sebagai permission, mengirim semua
hasil retrieval ke LLM lalu mengandalkan prompt untuk menyembunyikan data
internal, serta mempublikasikan draft AI yang memiliki dependency internal.

## Decision

Layer Academy menambahkan kontrak governance di `docs/ai/` sebagai overlay
integrasi. Overlay ini:

- tidak menimpa governance source;
- menggunakan sidecar registry untuk metadata dokumen lama;
- mengharuskan snapshot/version/provenance untuk source Git;
- menerapkan audience dan role ACL sebelum context masuk ke LLM;
- mewajibkan lineage dan human approval untuk output yang dapat dipublish;
- memisahkan capability Admin APPI dari akses unrestricted;
- dimulai dalam kondisi opt-in/read-only sampai connector benar-benar direview.

## Options considered

### Option A: Replace or normalize the governance repository

| Dimension | Assessment |
| --- | --- |
| Complexity | High |
| Safety | Low; berisiko mengubah source of truth |
| Auditability | Ambiguous saat history dipindahkan |
| Reversibility | Low |

**Pros:** satu format metadata terlihat seragam.  
**Cons:** dapat menimpa konvensi existing dan memperluas scope di luar Layer
Academy.

### Option B: Add a versioned governance overlay (chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium |
| Safety | High; source existing tidak disentuh |
| Auditability | High melalui registry, ref, path, dan commit SHA |
| Reversibility | High; source dapat dinonaktifkan dari registry |

**Pros:** kompatibel dengan governance existing, dapat diterapkan bertahap,
dan memberi boundary security sebelum retrieval aktif.  
**Cons:** membutuhkan registry/sidecar dan proses sinkronisasi tambahan.

### Option C: Query GitHub live untuk setiap pertanyaan

| Dimension | Assessment |
| --- | --- |
| Complexity | Low pada prototipe |
| Safety | Low; ACL, snapshot, dan availability sulit dijamin |
| Latency | Variable |
| Auditability | Weak tanpa snapshot |

**Pros:** source selalu terlihat paling baru.  
**Cons:** tidak cocok sebagai retrieval path utama APPI karena lambat,
bergantung network, dan mudah melewati governance boundary.

## Consequences

- Governance repository existing tidak perlu diubah agar dapat diintegrasikan.
- Knowledge lama tanpa metadata harus diperlakukan konservatif.
- Implementasi memerlukan source registry, provenance, ACL query, dan review
  state tambahan.
- Admin Copilot dapat membantu membuat draft, tetapi publish tetap berada pada
  human approval.
- Connector dan retrieval harus diimplementasikan pada tahap berikutnya; file
  ini sendiri tidak mengaktifkan akses ke repository eksternal.

## Action items

1. [ ] Review dan approve `KNOWLEDGE_GOVERNANCE_CONTRACT.md`.
2. [ ] Tetapkan owner dan ref resmi untuk setiap source repository.
3. [ ] Buat sidecar registry non-secret untuk artifact yang boleh di-snapshot.
4. [ ] Implementasikan dry-run ingestion dan report ACL sebelum LLM integration.
5. [ ] Tambahkan test untuk learner/customer versus internal/restricted access.
6. [ ] Tambahkan lineage dan publication review sebelum Admin Copilot mutation
   tools diaktifkan.
