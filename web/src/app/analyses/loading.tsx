import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalysesLoading() {
  return (
    <SidebarInset>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>

        <Skeleton className="h-[420px] w-full rounded-4xl" />
        <Skeleton className="h-16 w-full rounded-3xl" />
      </div>
    </SidebarInset>
  );
}
