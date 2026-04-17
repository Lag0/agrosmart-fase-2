"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeSeriesPoint } from "@/shared/db/queries/time-series";

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

const SEVERITY_COLORS = {
  healthy: "#22c55e",
  beginning: "#f59e0b",
  diseased: "#ef4444",
} as const;

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(d: string) => d.slice(5)}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="healthy"
          stackId="1"
          stroke={SEVERITY_COLORS.healthy}
          fill={SEVERITY_COLORS.healthy}
          fillOpacity={0.4}
        />
        <Area
          type="monotone"
          dataKey="beginning"
          stackId="1"
          stroke={SEVERITY_COLORS.beginning}
          fill={SEVERITY_COLORS.beginning}
          fillOpacity={0.4}
        />
        <Area
          type="monotone"
          dataKey="diseased"
          stackId="1"
          stroke={SEVERITY_COLORS.diseased}
          fill={SEVERITY_COLORS.diseased}
          fillOpacity={0.4}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
