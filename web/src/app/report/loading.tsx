import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportLoading() {
  return (
    <SidebarInset>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>

        <Skeleton className="h-[280px] w-full rounded-4xl" />
        <Skeleton className="h-[320px] w-full rounded-4xl" />
      </div>
    </SidebarInset>
  );
}
