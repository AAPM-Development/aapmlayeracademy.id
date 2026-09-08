// @ts-nocheck
import React from "react";
import { Button, Surface } from "@/components/primitives";
import AapmIcon from "@/components/icons/AapmIcon";
import PageHeader from "@/components/layout/PageHeader";

export function AdminPageFrame({ eyebrow = "Administrasi", title, description, actions, children, wide = false, editor = false }) {
  const widthClass = editor ? "max-w-7xl" : wide ? "max-w-[1800px]" : "max-w-[1500px]";
  return (
    <div className={`mx-auto w-full ${widthClass} p-4 sm:p-6 lg:p-8`} data-t7-rail="application">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export function AdminLoading({ label = "Memuat data workspace…" }) {
  return <Surface variant="muted" className="flex min-h-52 items-center justify-center gap-3 p-6 text-sm text-muted-foreground"><AapmIcon name="loading" className="h-5 w-5 animate-spin text-brand-green" />{label}</Surface>;
}

export function AdminError({ error, onRetry }) {
  return <Surface tone="orange" className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><AapmIcon name="alert" className="h-6 w-6 text-tint-orange-foreground" /><div className="mt-3 text-sm font-semibold">Data admin belum dapat dimuat</div><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{error?.message || "Terjadi kendala saat mengambil data native."}</p>{onRetry && <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>Coba lagi</Button>}</Surface>;
}

export function AdminUnavailable({ title = "Belum tersedia", description = "Kemampuan ini belum didukung oleh API native." }) {
  return <Surface variant="muted" className="border-dashed p-6"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></Surface>;
}
