"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HeatmapRow } from "@/shared/db/queries/heatmap";

interface FarmHeatmapCardProps {
  data: HeatmapRow[];
}

export function FarmHeatmapCard({ data }: FarmHeatmapCardProps) {
  const maxAffected = Math.max(...data.map((r) => r.avgAffected), 1);

  function severityColor(value: number): string {
    const ratio = value / maxAffected;
    if (ratio < 0.3) return "var(--chart-1)";
    if (ratio < 0.6) return "var(--chart-2)";
    return "var(--destructive)";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">
          Mapa de calor por talhão
        </CardTitle>
        <CardDescription>Média de afetação nos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-3">
          {data.map((farm) => (
            <div key={farm.farmId} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{farm.farmName}</span>
              <div className="flex flex-col gap-1 pl-4">
                {data
                  .filter((r) => r.farmId === farm.farmId)
                  .map((field) => (
                    <div
                      key={field.fieldId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-muted-foreground w-28 truncate">
                        {field.fieldName}
                      </span>
                      <div className="flex-1">
                        <div
                          className="h-5 rounded"
                          style={{
                            width: `${Math.min((field.avgAffected / maxAffected) * 100, 100)}%`,
                            backgroundColor: severityColor(field.avgAffected),
                            minWidth: "4px",
                            opacity: 0.85,
                          }}
                        />
                      </div>
                      <span className="w-14 text-right tabular-nums">
                        {field.avgAffected}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
