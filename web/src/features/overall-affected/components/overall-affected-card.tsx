"use client";

import {
  Label,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { OverallAffected } from "@/shared/db/queries/overall-affected";

const chartConfig = {
  affected: { label: "Afetação média", color: "var(--chart-2)" },
} satisfies ChartConfig;

function getBarColor(value: number): string {
  if (value < 15) return "var(--chart-1)";
  if (value <= 30) return "var(--chart-2)";
  return "var(--destructive)";
}

type Props = {
  data: OverallAffected;
};

export function OverallAffectedCard({ data }: Props) {
  const safeAffectedPct = Math.min(Math.max(data.avgAffectedPct, 0), 100);
  const displayPct = Number(safeAffectedPct.toFixed(1));

  const chartData = [
    {
      name: "Afetação",
      value: safeAffectedPct,
      fill: getBarColor(safeAffectedPct),
    },
  ];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Índice de afetação geral</CardTitle>
        <CardDescription>
          Média ponderada — {data.totalAnalyses} análises
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[280px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={110}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <PolarRadiusAxis
              tick={false}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan className="fill-foreground text-3xl font-bold tabular-nums">
                          {displayPct}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 22}
                          className="fill-muted-foreground text-sm"
                        >
                          afetação média
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
            </PolarRadiusAxis>
            <RadialBar dataKey="value" background cornerRadius={6} />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
