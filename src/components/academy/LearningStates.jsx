import React from "react";
import { AlertCircle, BookOpen, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card, CardContent, IconTile, Skeleton } from "@/components/primitives";

export function LearningLoading({ label = "Memuat pengalaman belajar...", lines = 3 } = {}) {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-3/4 max-w-xl" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-10 w-36" />
        </CardContent>
      </Card>
      {Array.from({ length: lines }, (_, index) => (
        <Card key={index} className="shadow-none">
          <CardContent className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LearningErrorState({ title = "Learning data belum tersedia", description = "Coba muat ulang halaman untuk mengambil data terbaru.", onRetry = null } = {}) {
  return (
    <Card className="border-danger/25 bg-danger/5 shadow-none" role="alert">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <IconTile icon={AlertCircle} tone="orange" size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {onRetry && (
          <Button type="button" variant="outline" onClick={onRetry} className="shrink-0">
            <RefreshCw /> Coba lagi
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function LearningEmptyState({ title = "Belum ada materi", description = "Materi belajar akan muncul di sini saat sudah tersedia.", actionLabel = "Buka Learning Path", actionTo = "/modules" } = {}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center p-8 text-center sm:p-10">
        <IconTile icon={BookOpen} tone="green" size="lg" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        {actionLabel && actionTo && (
          <Button asChild variant="soft" className="mt-5">
            <Link to={actionTo}>{actionLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
