import type { ExportAnalysisRecord } from "./types";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(timestamp));
}

export function encodeCsv(records: ExportAnalysisRecord[]): string {
  const headers = [
    "id",
    "data_captura",
    "fazenda",
    "talhao",
    "severidade",
    "severidade_pt",
    "tipo_praga",
    "tipo_praga_ia",
    "confianca_ia",
    "pct_afetada",
    "pixels_folha",
    "pixels_doentes",
    "warnings",
  ];

  const lines = records.map((record) => {
    const values = [
      record.id,
      formatDate(record.capturedAt),
      record.farmName,
      record.fieldName,
      record.severity,
      record.severityLabelPt,
      record.pestType,
      record.pestTypeAi ?? "",
      record.pestTypeConfidence == null
        ? ""
        : Number((record.pestTypeConfidence * 100).toFixed(1)).toString(),
      Number(record.affectedPct.toFixed(1)).toString(),
      String(record.leafPixels),
      String(record.diseasedPixels),
      record.warnings.join("|"),
    ];

    return values.map((value) => csvEscape(String(value))).join(",");
  });

  // UTF-8 BOM for Excel compatibility on pt-BR environments
  return `\ufeff${headers.join(",")}\n${lines.join("\n")}`;
}
