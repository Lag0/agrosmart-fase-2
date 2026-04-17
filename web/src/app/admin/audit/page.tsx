import { SidebarInset } from "@/components/ui/sidebar";

export default function AuditPage() {
  return (
    <SidebarInset>
      <div className="flex flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div>
          <h1>Auditoria</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Registro de uploads
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border/50 bg-muted/20 p-12 text-center text-sm font-medium text-muted-foreground">
          [ Mock ] O histórico de auditoria e logs será renderizado aqui.
        </div>
      </div>
    </SidebarInset>
  );
}
