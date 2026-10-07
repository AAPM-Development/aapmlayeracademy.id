import React from "react";
import { Link } from "react-router-dom";
import { Button, Skeleton, StateView } from "@/design-system";

export function LearningLoading({ label = "Memuat pengalaman belajar...", lines = 3 } = {}) {
  return (
    <div className="grid gap-3" role="status" aria-live="polite" aria-label={label}>
      <Skeleton className="h-24 w-full rounded-[var(--aapm-component-surface-radius)]" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-[var(--aapm-component-surface-radius)]" />
      ))}
      <span className="aapm-visually-hidden">{label}</span>
    </div>
  );
}

export function LearningErrorState({ title = "Data belajar belum tersedia", description = "Coba muat ulang beberapa saat lagi.", onRetry = null } = {}) {
  return (
    <StateView
      kind="error"
      title={title}
      description={description}
      action={onRetry ? <Button variant="secondary" leadingIcon="refresh" onClick={onRetry}>Coba lagi</Button> : null}
    />
  );
}

export function LearningEmptyState({ title = "Belum ada materi", description = "Materi belajar akan muncul di sini.", actionLabel = "Kembali ke beranda", actionTo = "/" } = {}) {
  return (
    <StateView
      kind="empty"
      icon="modules"
      title={title}
      description={description}
      action={actionLabel && actionTo ? <Button asChild variant="secondary"><Link to={actionTo}>{actionLabel}</Link></Button> : null}
    />
  );
}
