import { SidebarInset } from "@/components/ui/sidebar";
import { UploadDropzone } from "@/features/upload/components/upload-dropzone";

export default function UploadPage() {
  return (
    <SidebarInset>
      <div className="flex flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div>
          <h1>Upload</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Envie imagens para análise de pragas e doenças
          </p>
        </div>
        <UploadDropzone />
      </div>
    </SidebarInset>
  );
}
