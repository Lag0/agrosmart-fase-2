"use client";

import {
  useRef,
  useState,
  useTransition,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { toast } from "sonner";
import { RiUploadCloud2Line, RiImageLine, RiCloseLine, RiLoaderLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadImage, type UploadResult } from "@/features/upload/actions/upload-image";
import { ERROR_COPY_PT } from "@/shared/lib/error-copy-pt";
import { PestTypeSelect, type PestTypeValue } from "./pest-type-select";
import { UploadResultCard } from "./upload-result-card";

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
const ACCEPT_STRING = ACCEPTED_MIME.join(",");

const EXT_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

function guessMimeFromExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  const ext = filename.slice(dot).toLowerCase();
  return EXT_MIME_MAP[ext] ?? "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone() {
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pestType, setPestType] = useState<PestTypeValue>("nao_identificado");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyFile = useCallback((candidate: File) => {
    // Some browsers don't set File.type on drag-and-drop (e.g. .webp → "")
    const effectiveType =
      candidate.type || guessMimeFromExtension(candidate.name);
    if (!ACCEPTED_MIME.includes(effectiveType)) {
      toast.error(ERROR_COPY_PT.INVALID_MIME);
      return;
    }
    if (candidate.size > 8 * 1024 * 1024) {
      toast.error(ERROR_COPY_PT.IMAGE_TOO_LARGE);
      return;
    }
    // Revoke previous preview to avoid memory leak
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(candidate);
    });
    setFile(candidate);
    setResult(null);
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) applyFile(selected);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [applyFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (isPending) return;
      const dropped = e.dataTransfer.files[0];
      if (dropped) applyFile(dropped);
    },
    [applyFile, isPending],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!isPending) setIsDragging(true);
    },
    [isPending],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the drop zone itself, not child elements
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleClearFile = useCallback(() => {
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(null);
  }, []);

  const handleReset = useCallback(() => {
    handleClearFile();
  }, [handleClearFile]);

  const handleSubmit = useCallback(() => {
    if (!file || isPending) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("requestId", crypto.randomUUID());
      fd.append("pestType", pestType);

      const res = await uploadImage(fd);

      if (res.success) {
        setResult(res.data);
        // Clear the file/preview after successful upload
        setFile(null);
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        if (res.data.duplicate) {
          toast.info("Esta imagem já foi analisada anteriormente.");
        } else {
          toast.success("Análise concluída!");
        }
      } else {
        toast.error(ERROR_COPY_PT[res.error.code] ?? "Erro desconhecido.");
      }
    });
  }, [file, isPending, pestType]);

  if (result) {
    return <UploadResultCard result={result} onReset={handleReset} />;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={isPending ? -1 : 0}
        aria-label="Área de upload de imagem"
        aria-disabled={isPending}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!isPending) fileInputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (!isPending && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-4 rounded-4xl border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isPending && "pointer-events-none cursor-not-allowed opacity-60",
          file && "bg-muted/20",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          className="sr-only"
          onChange={handleFileChange}
          disabled={isPending}
          aria-hidden="true"
          tabIndex={-1}
        />

        {file && preview ? (
          /* Preview state */
          <div className="flex w-full flex-col items-center gap-3">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Pré-visualização da imagem selecionada"
                className="max-h-[180px] max-w-full rounded-2xl object-contain shadow-sm"
              />
              {!isPending && (
                <button
                  type="button"
                  aria-label="Remover imagem"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearFile();
                  }}
                  className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                >
                  <RiCloseLine className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <RiImageLine className="size-4 shrink-0" />
              <span className="max-w-[200px] truncate font-medium text-foreground">
                {file.name}
              </span>
              <span>·</span>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <RiUploadCloud2Line className="size-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                Arraste uma imagem ou{" "}
                <span className="text-primary underline-offset-2 hover:underline">
                  clique para selecionar
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WEBP ou BMP · Máx. 8 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pest type selector */}
      <PestTypeSelect
        value={pestType}
        onChange={setPestType}
        disabled={isPending}
      />

      {/* Submit button */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !file}
        aria-busy={isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? (
          <>
            <RiLoaderLine className="animate-spin" />
            Analisando...
          </>
        ) : (
          <>
            <RiUploadCloud2Line />
            Analisar imagem
          </>
        )}
      </Button>
    </div>
  );
}
