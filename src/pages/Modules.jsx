import React from "react";
import { Layers } from "lucide-react";
import ContentContainer from "@/components/layout/ContentContainer";
import PageHeader from "@/components/layout/PageHeader";
import LearningRoadmap from "@/components/academy/LearningRoadmap";
import { Skeleton } from "@/components/ui/skeleton";
import { useModules, useUserProgress } from "@/lib/useCourseData";

export default function Modules() {
  const { data: modules = [], isLoading } = useModules();
  const { data: progress = [] } = useUserProgress();

  return (
    <ContentContainer>
      <PageHeader eyebrow="Learning path" title="Jalur pembelajaran" description="22 modul dalam 14 learning level. Ikuti status setiap modul dari current hingga completed." actions={<div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground"><Layers className="h-3.5 w-3.5 text-brand-green" /> 22 modules · 14 levels</div>} />
      {isLoading ? <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="space-y-2 rounded-xl border border-border p-5"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>)}</div> : <LearningRoadmap modules={modules} progress={progress} />}
    </ContentContainer>
  );
}
