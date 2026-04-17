export type ExportAnalysisRecord = {
  id: string;
  capturedAt: number;
  farmName: string;
  fieldName: string;
  severity: string;
  severityLabelPt: string;
  pestType: string;
  pestTypeAi: string | null;
  pestTypeConfidence: number | null;
  affectedPct: number;
  leafPixels: number;
  diseasedPixels: number;
  warnings: string[];
};
