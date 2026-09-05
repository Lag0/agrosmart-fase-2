import { createHash } from "node:crypto";
import { getHeatmap } from "@/shared/db/queries/heatmap";
import { getKpis } from "@/shared/db/queries/kpis";
import { getOverallAffected } from "@/shared/db/queries/overall-affected";
import { getPestBreakdown } from "@/shared/db/queries/pest-breakdown";
import { getTimeSeries } from "@/shared/db/queries/time-series";
import { formatPestLabel } from "@/shared/lib/format";

/** Snapshot do campo entregue ao modelo generativo como contexto. */
export type FieldContext = {
  periodDays: number;
  totals: {
    analyses: number;
    healthyPct: number;
    beginningPct: number;
    diseasedPct: number;
    avgAffectedPct: number;
  };
  trend: {
    firstHalfDiseasedPct: number;
    secondHalfDiseasedPct: number;
    deltaPct: number;
  };
  pests: Array<{ label: string; count: number; avgAffectedPct: number }>;
  fields: Array<{
    farm: string;
    field: string;
    avgAffectedPct: number;
    samples: number;
  }>;
};

const PERIOD_DAYS = 30;
const MAX_FIELDS = 12;
const MAX_PESTS = 5;

function diseasedShare(
  points: Array<{ healthy: number; beginning: number; diseased: number }>,
): number {
  const total = points.reduce(
    (sum, p) => sum + p.healthy + p.beginning + p.diseased,
    0,
  );
  if (total === 0) return 0;
  const diseased = points.reduce((sum, p) => sum + p.diseased, 0);
  return Number(((diseased / total) * 100).toFixed(1));
}

/**
 * Agrega o mesmo recorte que o painel exibe (30 dias) num objeto compacto.
 * É este objeto — e nada além dele — que vai no prompt do modelo.
 */
export async function buildFieldContext(): Promise<FieldContext> {
  const [kpis, overall, pestBreakdown, timeSeries, heatmap] = await Promise.all(
    [
      getKpis(),
      getOverallAffected(),
      getPestBreakdown(),
      getTimeSeries(),
      getHeatmap(),
    ],
  );

  const half = Math.floor(timeSeries.length / 2);
  const firstHalfDiseasedPct = diseasedShare(timeSeries.slice(0, half));
  const secondHalfDiseasedPct = diseasedShare(timeSeries.slice(half));

  return {
    periodDays: PERIOD_DAYS,
    totals: {
      analyses: kpis.total,
      healthyPct: kpis.healthyPct,
      beginningPct: kpis.beginningPct,
      diseasedPct: kpis.diseasedPct,
      avgAffectedPct: overall.avgAffectedPct,
    },
    trend: {
      firstHalfDiseasedPct,
      secondHalfDiseasedPct,
      deltaPct: Number(
        (secondHalfDiseasedPct - firstHalfDiseasedPct).toFixed(1),
      ),
    },
    pests: pestBreakdown.slice(0, MAX_PESTS).map((row) => ({
      label: formatPestLabel(row.pestType),
      count: row.count,
      avgAffectedPct: Number(row.avgAffectedPct ?? 0),
    })),
    fields: heatmap
      .filter((row) => row.sampleCount > 0)
      .sort((a, b) => b.avgAffected - a.avgAffected)
      .slice(0, MAX_FIELDS)
      .map((row) => ({
        farm: row.farmName,
        field: row.fieldName,
        avgAffectedPct: Number(row.avgAffected ?? 0),
        samples: row.sampleCount,
      })),
  };
}

/** Chave de cache: mesmo contexto, mesma resposta, sem gastar tokens de novo. */
export function contextCacheKey(context: FieldContext, model: string): string {
  return createHash("sha256")
    .update(`${model}:${JSON.stringify(context)}`)
    .digest("hex");
}
