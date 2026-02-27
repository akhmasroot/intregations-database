"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Type, Hash, ToggleLeft, Calendar, Key, Braces, Binary } from "lucide-react";

export type ColumnType =
  | "text"
  | "varchar"
  | "integer"
  | "bigint"
  | "boolean"
  | "timestamp"
  | "timestamptz"
  | "uuid"
  | "jsonb"
  | "numeric"
  | "float"
  | "serial"
  | "bigserial";

interface ColumnTypeOption {
  value: ColumnType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "text" | "number" | "boolean" | "date" | "special";
}

export const COLUMN_TYPES: ColumnTypeOption[] = [
  {
    value: "text",
    label: "Text",
    description: "Variable-length string",
    icon: Type,
    category: "text",
  },
  {
    value: "varchar",
    label: "Varchar",
    description: "Variable-length string with limit",
    icon: Type,
    category: "text",
  },
  {
    value: "integer",
    label: "Integer",
    description: "32-bit integer (-2B to 2B)",
    icon: Hash,
    category: "number",
  },
  {
    value: "bigint",
    label: "BigInt",
    description: "64-bit integer",
    icon: Hash,
    category: "number",
  },
  {
    value: "numeric",
    label: "Numeric",
    description: "Exact decimal number",
    icon: Hash,
    category: "number",
  },
  {
    value: "float",
    label: "Float",
    description: "Floating-point number",
    icon: Hash,
    category: "number",
  },
  {
    value: "boolean",
    label: "Boolean",
    description: "True or false",
    icon: ToggleLeft,
    category: "boolean",
  },
  {
    value: "timestamp",
    label: "Timestamp",
    description: "Date and time (no timezone)",
    icon: Calendar,
    category: "date",
  },
  {
    value: "timestamptz",
    label: "Timestamp with TZ",
    description: "Date and time with timezone",
    icon: Calendar,
    category: "date",
  },
  {
    value: "uuid",
    label: "UUID",
    description: "Universally unique identifier",
    icon: Key,
    category: "special",
  },
  {
    value: "jsonb",
    label: "JSONB",
    description: "Binary JSON data",
    icon: Braces,
    category: "special",
  },
  {
    value: "serial",
    label: "Serial",
    description: "Auto-incrementing integer",
    icon: Binary,
    category: "number",
  },
  {
    value: "bigserial",
    label: "BigSerial",
    description: "Auto-incrementing bigint",
    icon: Binary,
    category: "number",
  },
];

interface ColumnTypeSelectorProps {
  value: ColumnType;
  onChange: (value: ColumnType) => void;
  disabled?: boolean;
}

export function ColumnTypeSelector({
  value,
  onChange,
  disabled,
}: ColumnTypeSelectorProps) {
  const selectedType = COLUMN_TYPES.find((t) => t.value === value);
  const Icon = selectedType?.icon;

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ColumnType)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            <span>{selectedType?.label ?? value}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {COLUMN_TYPES.map((type) => {
          const TypeIcon = type.icon;
          return (
            <SelectItem key={type.value} value={type.value}>
              <div className="flex items-center gap-2">
                <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {type.description}
                  </div>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
