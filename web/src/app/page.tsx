import { Suspense } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { FarmHeatmapServer } from "@/features/farm-heatmap/server/get-farm-heatmap";
import { KpiRowServer } from "@/features/kpis/server/get-kpis";
import { PestBreakdownServer } from "@/features/pest-breakdown/server/get-pest-breakdown";
import { TimeSeriesServer } from "@/features/time-series/server/get-time-series";

function CardSkeleton() {
  return <Skeleton className="h-[250px] w-full rounded-xl" />;
}

export default function HomePage() {
  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/">AgroSmart</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          }
        >
          <KpiRowServer />
        </Suspense>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Suspense fallback={<CardSkeleton />}>
            <TimeSeriesServer />
          </Suspense>
          <Suspense fallback={<CardSkeleton />}>
            <PestBreakdownServer />
          </Suspense>
        </div>
        <Suspense fallback={<CardSkeleton />}>
          <FarmHeatmapServer />
        </Suspense>
      </div>
    </SidebarInset>
  );
}
