import { sql } from "drizzle-orm";
import { db } from "../client";
import { analyses } from "../schema";

export type GalleryItem = {
  id: string;
  imageSha256: string;
  severity: string;
  severityLabelPt: string;
  pestType: string;
  affectedPct: number;
  thumbnailPath: string | null;
  capturedAt: number; // timestamp_ms
};

const THIRTY_DAYS_MS = 30 * 86_400_000;

export async function getGalleryItems(limit = 10): Promise<GalleryItem[]> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  return db
    .select({
      id: analyses.id,
      imageSha256: analyses.imageSha256,
      severity: analyses.severity,
      severityLabelPt: analyses.severityLabelPt,
      pestType: analyses.pestType,
      affectedPct: analyses.affectedPct,
      thumbnailPath: analyses.thumbnailPath,
      capturedAt: sql<number>`${analyses.capturedAt}`,
    })
    .from(analyses)
    .where(sql`${analyses.capturedAt} >= ${since.getTime()}`)
    .orderBy(sql`${analyses.capturedAt} desc`)
    .limit(limit);
}
