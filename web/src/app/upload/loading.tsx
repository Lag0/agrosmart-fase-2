import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function UploadLoading() {
  return (
    <SidebarInset>
      <div className="flex flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>

        <Skeleton className="h-[280px] w-full rounded-4xl" />
        <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
    </SidebarInset>
  );
}
