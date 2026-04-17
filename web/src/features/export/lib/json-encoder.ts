import type { ExportAnalysisRecord } from "./types";

export function encodeJson(records: ExportAnalysisRecord[]): string {
  return JSON.stringify(
    records.map((record) => ({
      id: record.id,
      capturedAt: record.capturedAt,
      farmName: record.farmName,
      fieldName: record.fieldName,
      severity: record.severity,
      severityLabelPt: record.severityLabelPt,
      pestType: record.pestType,
      pestTypeAi: record.pestTypeAi,
      pestTypeConfidence: record.pestTypeConfidence,
      affectedPct: record.affectedPct,
      leafPixels: record.leafPixels,
      diseasedPixels: record.diseasedPixels,
      warnings: record.warnings,
    })),
    null,
    2,
  );
}
