import { sql } from "drizzle-orm";
import { db } from "../client";
import { analyses } from "../schema";

export type TimeSeriesPoint = {
  date: string;
  healthy: number;
  beginning: number;
  diseased: number;
};

const THIRTY_DAYS_MS = 30 * 86_400_000;

export async function getTimeSeries(): Promise<TimeSeriesPoint[]> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const rows = await db
    .select({
      date: sql<string>`date(${analyses.capturedAt} / 1000, 'unixepoch')`.as(
        "date",
      ),
      severity: analyses.severity,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(analyses)
    .where(sql`${analyses.capturedAt} >= ${since.getTime()}`)
    .groupBy(
      sql`date(${analyses.capturedAt} / 1000, 'unixepoch')`,
      analyses.severity,
    )
    .orderBy(sql`date(${analyses.capturedAt} / 1000, 'unixepoch')`);

  // Pivot: rows → one point per date
  const map = new Map<string, TimeSeriesPoint>();

  for (const row of rows) {
    let point = map.get(row.date);
    if (!point) {
      point = { date: row.date, healthy: 0, beginning: 0, diseased: 0 };
      map.set(row.date, point);
    }
    if (row.severity === "healthy") point.healthy = row.count;
    if (row.severity === "beginning") point.beginning = row.count;
    if (row.severity === "diseased") point.diseased = row.count;
  }

  return Array.from(map.values());
}
