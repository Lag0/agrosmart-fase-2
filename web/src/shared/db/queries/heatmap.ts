import { count, sql, eq } from "drizzle-orm";
import { analyses, farms, fields } from "../schema";
import { db } from "../client";

export type HeatmapRow = {
  farmId: string;
  farmName: string;
  fieldId: string;
  fieldName: string;
  avgAffected: number;
  sampleCount: number;
};

const THIRTY_DAYS_MS = 30 * 86_400_000;

export async function getHeatmap(): Promise<HeatmapRow[]> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  return db
    .select({
      farmId: farms.id,
      farmName: farms.name,
      fieldId: fields.id,
      fieldName: fields.name,
      avgAffected: sql<number>`round(avg(${analyses.affectedPct}), 1)`.as(
        "avg_affected",
      ),
      sampleCount: sql<number>`count(${analyses.id})`.as("sample_count"),
    })
    .from(fields)
    .innerJoin(farms, eq(fields.farmId, farms.id))
    .leftJoin(
      analyses,
      sql`${analyses.fieldId} = ${fields.id} and ${analyses.capturedAt} >= ${since.getTime()}`,
    )
    .groupBy(farms.id, fields.id)
    .orderBy(farms.name, fields.name);
}