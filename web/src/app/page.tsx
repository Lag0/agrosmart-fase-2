import { Suspense } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/features/export/components/export-button";
import { FarmHeatmapServer } from "@/features/farm-heatmap/server/get-farm-heatmap";
import { GalleryStripSkeleton } from "@/features/gallery/components/gallery-strip";
import { GalleryServer } from "@/features/gallery/server/get-gallery";
import { KpiCardsServer } from "@/features/kpis/server/get-kpis";
import { OverallAffectedServer } from "@/features/overall-affected/server/get-overall-affected";
import { PestRadialServer } from "@/features/pest-breakdown/server/get-pest-radial";
import { TimeSeriesServer } from "@/features/time-series/server/get-time-series";

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 @5xl/main:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[120px] rounded-4xl" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-[300px] w-full rounded-4xl" />;
}

export default function HomePage() {
  return (
    <SidebarInset>
      <div className="flex flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1>Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Visão geral da plataforma
            </p>
          </div>
          <ExportButton />
        </div>
        {/* KPIs */}
        <Suspense fallback={<KpiSkeleton />}>
          <KpiCardsServer />
        </Suspense>

        {/* Evolução temporal */}
        <Suspense fallback={<ChartSkeleton />}>
          <TimeSeriesServer />
        </Suspense>

        {/* Mapa de calor */}
        <Suspense fallback={<ChartSkeleton />}>
          <FarmHeatmapServer />
        </Suspense>

        {/* Distribuição por praga + Índice geral */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          <div className="lg:col-span-4">
            <Suspense fallback={<ChartSkeleton />}>
              <PestRadialServer />
            </Suspense>
          </div>
          <div className="h-full lg:col-span-3">
            <Suspense fallback={<ChartSkeleton />}>
              <OverallAffectedServer />
            </Suspense>
          </div>
        </div>

        {/* Análises recentes */}
        <Suspense fallback={<GalleryStripSkeleton />}>
          <GalleryServer />
        </Suspense>
      </div>
    </SidebarInset>
  );
}
