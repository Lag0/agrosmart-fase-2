"use client";

import { Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PEST_TYPES } from "@/shared/lib/format";
import type { PestBreakdownRow } from "@/shared/db/queries/pest-breakdown";

const chartConfig = Object.fromEntries(
  PEST_TYPES.map((p) => [
    p.value,
    { label: p.short, color: p.color },
  ]),
) satisfies ChartConfig;

interface PestRadialCardProps {
  data: PestBreakdownRow[];
}

export function PestRadialCard({ data }: PestRadialCardProps) {
  const total = data.reduce((sum, r) => sum + r.count, 0);

  const chartData = data.map((row) => ({
    pestType: row.pestType,
    count: row.count,
    fill: `var(--color-${row.pestType})`,
  }));

  const hasRenderableData = total > 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Distribuição por praga</CardTitle>
        <CardDescription>
          {total.toLocaleString("pt-BR")} ocorrências nos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {!hasRenderableData ? (
          <div className="text-muted-foreground flex h-[300px] items-center justify-center rounded-2xl border border-dashed text-sm">
            Sem ocorrências para distribuição nos últimos 30 dias.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[300px]"
          >
            <PieChart>
              <Pie data={chartData} dataKey="count" nameKey="pestType" />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <ChartLegend
                content={<ChartLegendContent nameKey="pestType" />}
                className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}