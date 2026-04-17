"use client";

import {
  RiCloseLine,
  RiImageLine,
  RiLoaderLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import { type ChangeEvent, type DragEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type UploadResult,
  uploadImage,
} from "@/features/upload/actions/upload-image";
import { cn } from "@/lib/utils";
import { ERROR_COPY_PT } from "@/shared/lib/error-copy-pt";
import { PestTypeSelect, type PestTypeValue } from "./pest-type-select";
import { UploadResultCard } from "./upload-result-card";

const ACCEPTED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/bmp",
] as const;
const HEIC_MIME = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const;
const ACCEPT_STRING = [...ACCEPTED_MIME, ...HEIC_MIME, ".heic", ".heif"].join(
  ",",
);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EXT_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

function guessMimeFromExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  const ext = filename.slice(dot).toLowerCase();
  return EXT_MIME_MAP[ext] ?? "";
}

function isHeicFile(candidate: File): boolean {
  const inferredType = (
    candidate.type || guessMimeFromExtension(candidate.name)
  ).toLowerCase();

  if (HEIC_MIME.includes(inferredType as (typeof HEIC_MIME)[number])) {
    return true;
  }

  if (inferredType.includes("heic") || inferredType.includes("heif")) {
    return true;
  }

  const lowerName = candidate.name.toLowerCase();
  return lowerName.endsWith(".heic") || lowerName.endsWith(".heif");
}

function isAcceptedMime(value: string): boolean {
  return ACCEPTED_MIME.includes(value as (typeof ACCEPTED_MIME)[number]);
}

function resolveEffectiveMime(candidate: File): string {
  const normalizedType = candidate.type.toLowerCase();
  if (isAcceptedMime(normalizedType)) {
    return normalizedType;
  }
  return guessMimeFromExtension(candidate.name);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };

    image.src = url;
  });
}

async function transcodeToJpeg(
  source: File,
  options: { quality: number; maxDimension: number },
): Promise<File | null> {
  if (typeof document === "undefined") {
    return null;
  }

  try {
    const image = await loadImageFromFile(source);
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale =
      largestSide > options.maxDimension
        ? options.maxDimension / largestSide
        : 1;

    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", options.quality);
    });

    if (!blob) {
      return null;
    }

    const base = source.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return null;
  }
}

async function fitFileToConstraints(source: File): Promise<File | null> {
  let current = source;

  // If browser reported an unknown image MIME, normalize to JPEG first.
  if (
    !isAcceptedMime(resolveEffectiveMime(current)) &&
    current.type.startsWith("image/")
  ) {
    const normalized = await transcodeToJpeg(current, {
      quality: 0.9,
      maxDimension: 4096,
    });
    if (normalized) {
      current = normalized;
    }
  }

  if (current.size <= MAX_UPLOAD_BYTES) {
    return current;
  }

  const steps = [
    { quality: 0.86, maxDimension: 3600 },
    { quality: 0.78, maxDimension: 3000 },
    { quality: 0.7, maxDimension: 2400 },
    { quality: 0.62, maxDimension: 1920 },
  ];

  for (const step of steps) {
    const compressed = await transcodeToJpeg(current, step);
    if (!compressed) {
      continue;
    }
    current = compressed;

    if (current.size <= MAX_UPLOAD_BYTES) {
      return current;
    }
  }

  return current.size <= MAX_UPLOAD_BYTES ? current : null;
}

async function normalizeUploadFile(candidate: File): Promise<File | null> {
  if (!isHeicFile(candidate)) {
    return candidate;
  }

  try {
    const { default: heic2any } = await import("heic2any");

    const converted = await heic2any({
      blob: candidate,
      toType: "image/jpeg",
      quality: 0.92,
    });

    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!(blob instanceof Blob)) {
      return null;
    }

    const base = candidate.name.replace(/\.(heic|heif)$/i, "") || "upload";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pestType, setPestType] = useState<PestTypeValue>("nao_identificado");
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const applyFile = useCallback(async (candidate: File) => {
    const normalized = await normalizeUploadFile(candidate);
    if (!normalized) {
      const message =
        "Não foi possível converter a imagem HEIC. Tente JPEG/PNG.";
      setSelectionError(message);
      toast.error(message);
      return;
    }

    const finalFile = await fitFileToConstraints(normalized);
    if (!finalFile) {
      const message =
        "Imagem muito grande para upload. Use uma versão menor (até 8 MB).";
      setSelectionError(message);
      toast.error(message);
      return;
    }

    const effectiveType = resolveEffectiveMime(finalFile);
    if (!isAcceptedMime(effectiveType)) {
      const message = `${ERROR_COPY_PT.INVALID_MIME} (tipo detectado: ${finalFile.type || "desconhecido"})`;
      setSelectionError(message);
      toast.error(message);
      return;
    }

    // Revoke previous preview to avoid memory leak
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(finalFile);
    });
    setSelectionError(null);
    setFile(finalFile);
    setResult(null);
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        void applyFile(selected);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [applyFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (isSubmitting) return;
      const dropped = e.dataTransfer.files[0];
      if (dropped) {
        void applyFile(dropped);
      }
    },
    [applyFile, isSubmitting],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      if (!isSubmitting) setIsDragging(true);
    },
    [isSubmitting],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
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
    setSelectionError(null);
    setResult(null);
  }, []);

  const handleReset = useCallback(() => {
    handleClearFile();
  }, [handleClearFile]);

  const handleSubmit = useCallback(async () => {
    if (!file || isSubmitting) return;

    setIsSubmitting(true);
    try {
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
    } finally {
      setIsSubmitting(false);
    }
  }, [file, isSubmitting, pestType]);

  if (result) {
    return <UploadResultCard result={result} onReset={handleReset} />;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Drop zone */}
      <label
        aria-label="Área de upload de imagem"
        aria-disabled={isSubmitting}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-4 rounded-4xl border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isSubmitting && "pointer-events-none cursor-not-allowed opacity-60",
          file && "bg-muted/20",
        )}
      >
        <input
          type="file"
          accept={ACCEPT_STRING}
          className="sr-only"
          onChange={handleFileChange}
          disabled={isSubmitting}
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
              {!isSubmitting && (
                <button
                  type="button"
                  aria-label="Remover imagem"
                  onClick={(e) => {
                    e.preventDefault();
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
      </label>

      {selectionError ? (
        <p className="text-sm text-destructive">{selectionError}</p>
      ) : null}

      {/* Pest type selector */}
      <PestTypeSelect
        value={pestType}
        onChange={setPestType}
        disabled={isSubmitting}
      />

      {/* Submit button */}
      <Button
        type="button"
        onClick={() => {
          void handleSubmit();
        }}
        disabled={isSubmitting || !file}
        aria-busy={isSubmitting}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? (
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
