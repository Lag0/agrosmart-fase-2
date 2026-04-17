"use client";

import { RiInformationLine } from "@remixicon/react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const PEST_TYPES = [
  { value: "nao_identificado", label: "Não identificado" },
  { value: "ferrugem", label: "Ferrugem" },
  { value: "mancha_parda", label: "Mancha Parda" },
  { value: "oidio", label: "Oídio" },
  { value: "lagarta", label: "Lagarta" },
  { value: "outro", label: "Outro" },
] as const;

export type PestTypeValue = (typeof PEST_TYPES)[number]["value"];

interface PestTypeSelectProps {
  value: PestTypeValue;
  onChange: (value: PestTypeValue) => void;
  disabled?: boolean;
}

export function PestTypeSelect({
  value,
  onChange,
  disabled,
}: PestTypeSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="pest-type-select" className="text-sm font-medium">
          Tipo de praga
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="img"
              aria-label="Informação"
              className="text-muted-foreground cursor-help"
            >
              <RiInformationLine className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            Não sabe? Selecione &apos;Não identificado&apos;
          </TooltipContent>
        </Tooltip>
      </div>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as PestTypeValue)}
        disabled={disabled}
      >
        <SelectTrigger id="pest-type-select" className="w-full">
          <SelectValue placeholder="Selecione o tipo de praga" />
        </SelectTrigger>
        <SelectContent>
          {PEST_TYPES.map((pest) => (
            <SelectItem key={pest.value} value={pest.value}>
              {pest.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
