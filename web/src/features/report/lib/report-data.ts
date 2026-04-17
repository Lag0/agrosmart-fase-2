import { desc, eq } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { getKpis } from "@/shared/db/queries/kpis";
import { getOverallAffected } from "@/shared/db/queries/overall-affected";
import { getPestBreakdown } from "@/shared/db/queries/pest-breakdown";
import { getTimeSeries } from "@/shared/db/queries/time-series";
import { analyses, farms, fields, recommendations } from "@/shared/db/schema";
import { formatPestLabel } from "@/shared/lib/format";

export type ReportData = {
  generatedAt: number;
  periodLabel: string;
  kpis: {
    total: number;
    healthyPct: number;
    beginningPct: number;
    diseasedPct: number;
    pestTypes: number;
    avgAffectedPct: number;
  };
  trend: {
    last7Total: number;
    last7Diseased: number;
    last7DiseasedPct: number;
  };
  topPests: Array<{
    pestType: string;
    count: number;
    avgAffectedPct: number;
  }>;
  recommendation: {
    content: string;
    model: string;
    source: "latest_recommendation" | "fallback";
  };
  recentAnalyses: Array<{
    id: string;
    capturedAt: number;
    severityLabelPt: string;
    affectedPct: number;
    pestType: string;
    pestTypeAi: string | null;
    farmName: string;
    fieldName: string;
  }>;
};

const DAY_MS = 86_400_000;

export { formatPestLabel as formatPestTypeLabel } from "@/shared/lib/format";

function buildFallbackRecommendation(input: {
  avgAffectedPct: number;
  diseasedPct: number;
  beginningPct: number;
  dominantPest: string;
}): string {
  const { avgAffectedPct, diseasedPct, beginningPct, dominantPest } = input;

  if (diseasedPct >= 40 || avgAffectedPct >= 35) {
    return `Nível de risco alto: ${diseasedPct.toFixed(1)}% das análises no período estão classificadas como "Planta doente". Priorize inspeção presencial imediata nos talhões com maior incidência, inicie manejo direcionado para ${dominantPest} e reavalie em 48 horas.`;
  }

  if (diseasedPct >= 20 || avgAffectedPct >= 15 || beginningPct >= 30) {
    return `Nível de risco moderado: há sinais de evolução de doença no período. Reforce monitoramento de campo, aplique medidas preventivas focadas em ${dominantPest} e acompanhe a tendência diária para evitar avanço para severidade alta.`;
  }

  return "Nível de risco baixo: o cenário atual é estável. Mantenha rotina de monitoramento semanal, padronize captura de imagens por talhão e preserve ações preventivas para evitar aumento da severidade.";
}

export async function getReportData(): Promise<ReportData> {
  const [kpis, overall, pestBreakdown, timeSeries] = await Promise.all([
    getKpis(),
    getOverallAffected(),
    getPestBreakdown(),
    getTimeSeries(),
  ]);

  const topPests = pestBreakdown.slice(0, 5);

  const dominantPestRaw = topPests.find(
    (item) => item.pestType !== "nao_identificado",
  )?.pestType;
  const dominantPest = formatPestLabel(
    dominantPestRaw ?? "nao_identificado",
  );

  const latestRecommendation = await db
    .select({
      content: recommendations.content,
      model: recommendations.model,
    })
    .from(recommendations)
    .orderBy(desc(recommendations.createdAt))
    .limit(1);

  const recommendation = latestRecommendation[0]
    ? {
        content: latestRecommendation[0].content,
        model: latestRecommendation[0].model,
        source: "latest_recommendation" as const,
      }
    : {
        content: buildFallbackRecommendation({
          avgAffectedPct: overall.avgAffectedPct,
          diseasedPct: kpis.diseasedPct,
          beginningPct: kpis.beginningPct,
          dominantPest,
        }),
        model: "fallback-static-v1",
        source: "fallback" as const,
      };

  const recentAnalyses = await db
    .select({
      id: analyses.id,
      capturedAt: analyses.capturedAt,
      severityLabelPt: analyses.severityLabelPt,
      affectedPct: analyses.affectedPct,
      pestType: analyses.pestType,
      pestTypeAi: analyses.pestTypeAi,
      farmName: farms.name,
      fieldName: fields.name,
    })
    .from(analyses)
    .innerJoin(fields, eq(analyses.fieldId, fields.id))
    .innerJoin(farms, eq(fields.farmId, farms.id))
    .orderBy(desc(analyses.capturedAt))
    .limit(10);

  const last7 = timeSeries.slice(-7);
  const last7Total = last7.reduce(
    (sum, point) => sum + point.healthy + point.beginning + point.diseased,
    0,
  );
  const last7Diseased = last7.reduce((sum, point) => sum + point.diseased, 0);
  const last7DiseasedPct =
    last7Total > 0
      ? Number(((last7Diseased / last7Total) * 100).toFixed(1))
      : 0;

  return {
    generatedAt: Date.now(),
    periodLabel: "Últimos 30 dias",
    kpis: {
      total: kpis.total,
      healthyPct: kpis.healthyPct,
      beginningPct: kpis.beginningPct,
      diseasedPct: kpis.diseasedPct,
      pestTypes: kpis.pestTypes,
      avgAffectedPct: overall.avgAffectedPct,
    },
    trend: {
      last7Total,
      last7Diseased,
      last7DiseasedPct,
    },
    topPests,
    recommendation,
    recentAnalyses: recentAnalyses.map((row) => ({
      ...row,
      capturedAt:
        typeof row.capturedAt === "number"
          ? row.capturedAt
          : Number(row.capturedAt ?? Date.now()),
      affectedPct: Number(row.affectedPct),
      pestTypeAi: row.pestTypeAi ?? null,
    })),
  };
}

export function formatReportDate(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(timestamp));
}

export function periodStartLabel(generatedAt: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(generatedAt - 30 * DAY_MS));
}
