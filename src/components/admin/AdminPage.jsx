import React from "react";
import { Button, PageHeader, StateView } from "@/design-system";
import { Page } from "@/design-system/patterns/AppShell";

/** Admin route frame: one header anatomy and page width for every admin view. */
export function AdminPageFrame({ eyebrow = "Administrasi", title, description, actions, back, children, wide = false, editor = false }) {
  return (
    <Page width={editor || wide ? "wide" : undefined}>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} back={back} size="compact" />
      {children}
    </Page>
  );
}

export function AdminLoading({ label = "Memuat data workspace…" }) {
  return <StateView kind="loading" title={label} framed={false} />;
}

export function AdminError({ error, onRetry }) {
  return (
    <StateView
      kind="error"
      title="Data admin belum dapat dimuat"
      description={error?.message || "Terjadi kendala saat mengambil data native."}
      action={onRetry ? <Button variant="secondary" leadingIcon="refresh" onClick={onRetry}>Coba lagi</Button> : null}
    />
  );
}

export function AdminUnavailable({ title = "Belum tersedia", description = "Kemampuan ini belum didukung oleh API native." }) {
  return <StateView kind="empty" title={title} description={description} compact />;
}
