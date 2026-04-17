import { sql } from "drizzle-orm";
import { db } from "../client";
import { analyses } from "../schema";

export type OverallAffected = {
  avgAffectedPct: number;
  totalAnalyses: number;
  healthyCount: number;
  diseasedCount: number;
  beginningCount: number;
};

const THIRTY_DAYS_MS = 30 * 86_400_000;

export async function getOverallAffected(): Promise<OverallAffected> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const row = await db
    .select({
      avgAffectedPct: sql<number>`round(avg(${analyses.affectedPct}), 1)`.as("avg_affected_pct"),
      totalAnalyses: sql<number>`count(*)`.as("total"),
      healthyCount: sql<number>`sum(case when ${analyses.severity} = 'healthy' then 1 else 0 end)`,
      diseasedCount: sql<number>`sum(case when ${analyses.severity} = 'diseased' then 1 else 0 end)`,
      beginningCount: sql<number>`sum(case when ${analyses.severity} = 'beginning' then 1 else 0 end)`,
    })
    .from(analyses)
    .where(sql`${analyses.capturedAt} >= ${since.getTime()}`);

  const r = row[0];
  return {
    avgAffectedPct: r.avgAffectedPct ?? 0,
    totalAnalyses: r.totalAnalyses ?? 0,
    healthyCount: r.healthyCount ?? 0,
    diseasedCount: r.diseasedCount ?? 0,
    beginningCount: r.beginningCount ?? 0,
  };
}
