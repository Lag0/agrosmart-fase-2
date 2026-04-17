import AppShell from "@/shared/components/layout/app-shell";
import { PageHeader } from "@/shared/components/layout/page-header";

export default function ReportPage() {
  return (
    <AppShell>
      <PageHeader
        title="Relatório"
        description="Gere um relatório em PDF com recomendações"
      />
    </AppShell>
  );
}
