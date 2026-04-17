import { Badge } from "@/components/ui/badge";
import type { KpiData } from "@/shared/db/queries/kpis";

interface KpiRowProps {
  data: KpiData;
}

const SEVERITY_BADGE: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  healthy: "secondary",
  beginning: "outline",
  diseased: "destructive",
};

export function KpiRow({ data }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard label="Total de análises" value={String(data.total)} />
      <KpiCard
        label="Saudáveis"
        value={`${data.healthyPct}%`}
        badge={<Badge variant={SEVERITY_BADGE.healthy}>healthy</Badge>}
      />
      <KpiCard
        label="Início de doença"
        value={`${data.beginningPct}%`}
        badge={<Badge variant={SEVERITY_BADGE.beginning}>beginning</Badge>}
      />
      <KpiCard
        label="Doentes"
        value={`${data.diseasedPct}%`}
        badge={<Badge variant={SEVERITY_BADGE.diseased}>diseased</Badge>}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="bg-card border-border flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      {badge}
    </div>
  );
}
