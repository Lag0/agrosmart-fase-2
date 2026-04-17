import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { encodeCsv } from "@/features/export/lib/csv-encoder";
import { encodeJson } from "@/features/export/lib/json-encoder";
import type { ExportAnalysisRecord } from "@/features/export/lib/types";
import { db } from "@/shared/db/client";
import { analyses, farms, fields } from "@/shared/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseWarnings(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // ignore malformed warning payloads
  }
  return [];
}

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  if (format !== "csv" && format !== "json") {
    return NextResponse.json(
      { error: "Invalid format. Use 'csv' or 'json'." },
      { status: 400 },
    );
  }

  const rows = db
    .select({
      id: analyses.id,
      capturedAt: analyses.capturedAt,
      farmName: farms.name,
      fieldName: fields.name,
      severity: analyses.severity,
      severityLabelPt: analyses.severityLabelPt,
      pestType: analyses.pestType,
      pestTypeAi: analyses.pestTypeAi,
      pestTypeConfidence: analyses.pestTypeConfidence,
      affectedPct: analyses.affectedPct,
      leafPixels: analyses.leafPixels,
      diseasedPixels: analyses.diseasedPixels,
      warnings: analyses.warnings,
    })
    .from(analyses)
    .innerJoin(fields, eq(analyses.fieldId, fields.id))
    .innerJoin(farms, eq(fields.farmId, farms.id))
    .orderBy(desc(analyses.capturedAt))
    .all();

  const records: ExportAnalysisRecord[] = rows.map((row) => ({
    id: row.id,
    capturedAt: Number(row.capturedAt),
    farmName: row.farmName,
    fieldName: row.fieldName,
    severity: row.severity,
    severityLabelPt: row.severityLabelPt,
    pestType: row.pestType,
    pestTypeAi: row.pestTypeAi,
    pestTypeConfidence:
      row.pestTypeConfidence == null ? null : Number(row.pestTypeConfidence),
    affectedPct: Number(row.affectedPct),
    leafPixels: Number(row.leafPixels),
    diseasedPixels: Number(row.diseasedPixels),
    warnings: parseWarnings(row.warnings),
  }));

  const date = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new NextResponse(encodeJson(records), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="agrosmart-export-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(encodeCsv(records), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="agrosmart-export-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
