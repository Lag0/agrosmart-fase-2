"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import type { HeatmapRow } from "@/shared/db/queries/heatmap";

interface FarmHeatmapCardProps {
  data: HeatmapRow[];
}

const FARM_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function severityBadge(value: number): string {
  if (value < 30) return "🟢";
  if (value < 60) return "🟡";
  return "🔴";
}

function abbreviateFieldName(fieldName: string): string {
  const match = fieldName.match(/talh[aã]o\s*(\d+)/i);
  if (match) return `T${match[1]}`;
  return fieldName;
}

export function FarmHeatmapCard({ data }: FarmHeatmapCardProps) {
  // Unique farms in data order, assign colors
  const farmIds = [...new Set(data.map((r) => r.farmId))];
  const farmMeta = new Map<string, { name: string; color: string }>();
  farmIds.forEach((id, i) => {
    const row = data.find((r) => r.farmId === id);
    if (row) {
      farmMeta.set(id, {
        name: row.farmName,
        color: FARM_COLORS[i % FARM_COLORS.length],
      });
    }
  });

  const chartConfig = {
    avgAffected: {
      label: "Afetação média",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  // Group by farm, preserving farm order and field order.
  // Show up to 3 fields per farm for readability.
  const flat = farmIds.flatMap((farmId) =>
    data.filter((r) => r.farmId === farmId).slice(0, 3),
  );

  const chartData = flat.map((row) => {
    const meta = farmMeta.get(row.farmId);
    const farmShort = meta?.name.replace(/^Fazenda\s+/i, "") ?? "";
    const fieldShort = abbreviateFieldName(row.fieldName);

    return {
      label: `${farmShort} · ${fieldShort}`,
      fieldName: fieldShort,
      farmId: row.farmId,
      farmName: meta?.name ?? "",
      avgAffected: row.avgAffected,
      sampleCount: row.sampleCount,
      fill: meta?.color ?? "var(--chart-1)",
    };
  });

  const hasRenderableData = chartData.some((entry) => entry.sampleCount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa de calor por talhão</CardTitle>
        <CardDescription>Média de afetação nos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasRenderableData ? (
          <div className="text-muted-foreground flex h-[320px] items-center justify-center rounded-2xl border border-dashed text-sm">
            Sem amostras suficientes para o mapa de calor nos últimos 30 dias.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[320px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ left: 0 }}
            >
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={90}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <XAxis dataKey="avgAffected" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const meta = farmMeta.get(d.farmId);
                  return (
                    <div className="rounded-lg border bg-background p-3 text-sm shadow-md">
                      <div className="flex items-center gap-2 font-medium">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: d.fill ?? meta?.color }}
                        />
                        {d.farmName || meta?.name}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {d.fieldName ?? d.label} ·{" "}
                        {severityBadge(d.avgAffected)} {d.avgAffected}% ·{" "}
                        {d.sampleCount} amost.
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="avgAffected" radius={4}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {farmIds.map((farmId) => {
            const meta = farmMeta.get(farmId);
            if (!meta) return null;
            return (
              <div key={farmId} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-muted-foreground">{meta.name}</span>
              </div>
            );
          })}
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>🟢 &lt; 30% controlado</span>
          <span>🟡 30–60% atenção</span>
          <span>🔴 &gt; 60% crítico</span>
        </div>
      </CardFooter>
    </Card>
  );
}
