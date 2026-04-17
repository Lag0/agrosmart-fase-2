import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiRowServer } from "@/features/kpis/server/get-kpis";
import {
  CardSection,
  DashboardShell,
} from "@/shared/components/layout/app-shell";

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <DashboardShell>
      <Suspense fallback={<KpiSkeleton />}>
        <KpiRowServer />
      </Suspense>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CardSection title="Evolução temporal">
          <Skeleton className="h-56" />
        </CardSection>
        <CardSection title="Distribuição por praga">
          <Skeleton className="h-56" />
        </CardSection>
      </div>
      <CardSection title="Mapa de calor por talhão">
        <Skeleton className="h-48" />
      </CardSection>
    </DashboardShell>
  );
}
