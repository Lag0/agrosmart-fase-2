import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import type { ReactElement } from "react";
import { createElement } from "react";
import { ReportPdfDocument } from "@/features/report/components/report-pdf";
import { getReportData } from "@/features/report/lib/report-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getReportData();
    const pdfElement = createElement(ReportPdfDocument, {
      data,
    }) as ReactElement;

    const pdfBuffer = await renderToBuffer(
      pdfElement as Parameters<typeof renderToBuffer>[0],
    );

    const filename = `agrosmart-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[report-pdf-route]", error);
    return NextResponse.json(
      { error: "Falha ao gerar PDF do relatório." },
      { status: 500 },
    );
  }
}
