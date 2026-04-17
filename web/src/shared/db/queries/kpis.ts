import { count, sql } from "drizzle-orm";
import { db } from "../client";
import { analyses } from "../schema";

export type KpiData = {
  total: number;
  healthyPct: number;
  beginningPct: number;
  diseasedPct: number;
  pestTypes: number;
};

const THIRTY_DAYS_MS = 30 * 86_400_000;

export async function getKpis(): Promise<KpiData> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const row = await db
    .select({
      total: count(),
      healthy: sql<number>`sum(case when ${analyses.severity} = 'healthy' then 1 else 0 end)`,
      beginning: sql<number>`sum(case when ${analyses.severity} = 'beginning' then 1 else 0 end)`,
      diseased: sql<number>`sum(case when ${analyses.severity} = 'diseased' then 1 else 0 end)`,
      pestTypes: sql<number>`count(distinct ${analyses.pestType})`,
    })
    .from(analyses)
    .where(sql`${analyses.capturedAt} >= ${since.getTime()}`);

  const r = row[0];
  const total = r.total || 1; // avoid div-by-zero

  return {
    total: r.total,
    healthyPct: Math.round((r.healthy / total) * 1000) / 10,
    beginningPct: Math.round((r.beginning / total) * 1000) / 10,
    diseasedPct: Math.round((r.diseased / total) * 1000) / 10,
    pestTypes: r.pestTypes,
  };
}
