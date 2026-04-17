"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { PestBreakdownRow } from "@/shared/db/queries/pest-breakdown";

const PEST_LABELS: Record<string, string> = {
  ferrugem: "Ferrugem",
  mancha_parda: "Mancha parda",
  oidio: "Oídio",
  lagarta: "Lagarta",
  nao_identificado: "Não identificado",
};

const chartConfig = {
  count: { label: "Ocorrências" },
  avgAffectedPct: { label: "Afetado (%)" },
} satisfies ChartConfig;

interface PestBreakdownCardProps {
  data: PestBreakdownRow[];
}

export function PestBreakdownCard({ data }: PestBreakdownCardProps) {
  const chartData = data.map((row) => ({
    pest: PEST_LABELS[row.pestType] ?? row.pestType,
    count: row.count,
    avgAffectedPct: row.avgAffectedPct,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">
          Distribuição por praga
        </CardTitle>
        <CardDescription>Ocorrências nos últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-0 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="pest"
              type="category"
              tick={{ fontSize: 11 }}
              width={110}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
