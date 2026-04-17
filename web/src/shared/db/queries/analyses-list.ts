import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { analyses, farms, fields } from "../schema";

export type AnalysisListItem = {
  id: string;
  requestId: string;
  imageSha256: string;
  severity: string;
  severityLabelPt: string;
  pestType: string;
  pestTypeAi: string | null;
  affectedPct: number;
  thumbnailPath: string | null;
  fieldName: string;
  farmName: string;
  capturedAt: number;
};

export type AnalysisListPage = {
  items: AnalysisListItem[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export async function getAnalysesPage(
  page = 1,
  pageSize = 12,
): Promise<AnalysisListPage> {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;

  const totalRow = db
    .select({ count: sql<number>`count(*)` })
    .from(analyses)
    .get();

  const total = Number(totalRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const items = db
    .select({
      id: analyses.id,
      requestId: analyses.requestId,
      imageSha256: analyses.imageSha256,
      severity: analyses.severity,
      severityLabelPt: analyses.severityLabelPt,
      pestType: analyses.pestType,
      pestTypeAi: analyses.pestTypeAi,
      affectedPct: analyses.affectedPct,
      thumbnailPath: analyses.thumbnailPath,
      fieldName: fields.name,
      farmName: farms.name,
      capturedAt: sql<number>`${analyses.capturedAt}`,
    })
    .from(analyses)
    .innerJoin(fields, eq(analyses.fieldId, fields.id))
    .innerJoin(farms, eq(fields.farmId, farms.id))
    .orderBy(sql`${analyses.capturedAt} desc`)
    .limit(pageSize)
    .offset(offset)
    .all();

  return {
    items,
    total,
    totalPages,
    page: Math.min(safePage, totalPages),
    pageSize,
  };
}
