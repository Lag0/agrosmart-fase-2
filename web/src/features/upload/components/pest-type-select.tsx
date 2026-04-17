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
import { PEST_TYPES, type PestTypeValue } from "@/shared/lib/format";

export { PEST_TYPES, type PestTypeValue } from "@/shared/lib/format";

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