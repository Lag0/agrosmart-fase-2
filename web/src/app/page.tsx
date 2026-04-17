import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
        <KpiPlaceholder />
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

function KpiPlaceholder() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {[
        { label: "Total de análises", value: "—" },
        { label: "Saudáveis", value: "—" },
        { label: "Doentes", value: "—" },
        { label: "Tipos de praga", value: "—" },
      ].map((kpi) => (
        <div
          key={kpi.label}
          className="bg-card border-border rounded-lg border p-4"
        >
          <p className="text-muted-foreground text-xs">{kpi.label}</p>
          <p className="text-2xl font-bold">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}
