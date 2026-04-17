import { SidebarInset } from "@/components/ui/sidebar";
import { ReportView } from "@/features/report/components/report-view";
import { getReportData } from "@/features/report/lib/report-data";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const reportData = await getReportData();

  return (
    <SidebarInset>
      <div className="flex flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div>
          <h1>Relatório</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Consolidação operacional com exportação em PDF
          </p>
        </div>
        <ReportView data={reportData} />
      </div>
    </SidebarInset>
  );
}
