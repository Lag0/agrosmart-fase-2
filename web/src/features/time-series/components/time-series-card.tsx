"use client";

import { useState, useEffect, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardAction,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TimeSeriesPoint } from "@/shared/db/queries/time-series";

interface TimeSeriesCardProps {
  data: TimeSeriesPoint[];
}

const chartConfig = {
  healthy: { label: "Saudável", color: "var(--chart-1)" },
  beginning: { label: "Início", color: "var(--chart-2)" },
  diseased: { label: "Doente", color: "var(--destructive)" },
} satisfies ChartConfig;

export function TimeSeriesCard({ data }: TimeSeriesCardProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = useState("30d");

  useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const filteredData = useMemo(() => {
    if (timeRange === "7d") {
      return data.slice(-7);
    }
    return data;
  }, [data, timeRange]);

  const descriptionText =
    timeRange === "7d"
      ? "Últimos 7 dias"
      : "Últimos 30 dias";

  const descriptionFull =
    timeRange === "7d"
      ? "Distribuição de severidade nos últimos 7 dias"
      : "Distribuição de severidade nos últimos 30 dias";

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="font-heading text-sm font-semibold tracking-tight">
          Evolução temporal
        </CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {descriptionFull}
          </span>
          <span className="@[540px]/card:hidden">{descriptionText}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="7d">Últimos 7 dias</ToggleGroupItem>
            <ToggleGroupItem value="30d">Últimos 30 dias</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Período"
            >
              <SelectValue placeholder="Últimos 30 dias" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7d" className="rounded-lg">
                Últimos 7 dias
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Últimos 30 dias
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-0 sm:px-6 sm:pt-0">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart
            data={filteredData}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="fillHealthy" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-healthy)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-healthy)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillBeginning" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-beginning)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-beginning)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillDiseased" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-diseased)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-diseased)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={isMobile ? 48 : 32}
              tickFormatter={(value: string) => value.slice(5)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const str =
                      typeof value === "string" ? value : String(value);
                    return str.slice(5);
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              type="monotone"
              dataKey="diseased"
              stackId="1"
              stroke="var(--color-diseased)"
              fill="url(#fillDiseased)"
            />
            <Area
              type="monotone"
              dataKey="beginning"
              stackId="1"
              stroke="var(--color-beginning)"
              fill="url(#fillBeginning)"
            />
            <Area
              type="monotone"
              dataKey="healthy"
              stackId="1"
              stroke="var(--color-healthy)"
              fill="url(#fillHealthy)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
