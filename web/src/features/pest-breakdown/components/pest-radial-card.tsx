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
import type { PestBreakdownRow } from "@/shared/db/queries/pest-breakdown";

const PEST_LABELS: Record<string, string> = {
  ferrugem: "Ferrugem",
  mancha_parda: "Mancha parda",
  oidio: "Oídio",
  lagarta: "Lagarta",
  nao_identificado: "Não identif.",
};

interface PestRadialCardProps {
  data: PestBreakdownRow[];
}

const chartConfig = {
  ferrugem: { label: "Ferrugem", color: "var(--chart-1)" },
  mancha_parda: { label: "Mancha parda", color: "var(--chart-2)" },
  oidio: { label: "Oídio", color: "var(--chart-3)" },
  lagarta: { label: "Lagarta", color: "var(--chart-4)" },
  nao_identificado: { label: "Não identif.", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function PestRadialCard({ data }: PestRadialCardProps) {
  const total = data.reduce((sum, r) => sum + r.count, 0);

  const chartData = data.map((row) => ({
    pestType: row.pestType,
    count: row.count,
    fill: `var(--color-${row.pestType})`,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="font-heading text-sm font-semibold tracking-tight">
          Distribuição por praga
        </CardTitle>
        <CardDescription>
          {total.toLocaleString("pt-BR")} ocorrências nos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="pestType"
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend
              content={<ChartLegendContent nameKey="pestType" />}
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
