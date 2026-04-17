import { count, sql } from "drizzle-orm";
import { db } from "../client";
import { analyses } from "../schema";

export type PestBreakdownRow = {
  pestType: string;
  count: number;
  avgAffectedPct: number;
};

const THIRTY_DAYS_MS = 30 * 86_400_000;

export async function getPestBreakdown(): Promise<PestBreakdownRow[]> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  return db
    .select({
      pestType: analyses.pestType,
      count: count(),
      avgAffectedPct: sql<number>`round(avg(${analyses.affectedPct}), 1)`.as(
        "avg_affected_pct",
      ),
    })
    .from(analyses)
    .where(sql`${analyses.capturedAt} >= ${since.getTime()}`)
    .groupBy(analyses.pestType)
    .orderBy(sql`count(*) desc`);
}
