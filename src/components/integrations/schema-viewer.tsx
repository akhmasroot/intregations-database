"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Key, Hash, Type, ToggleLeft, Calendar, Braces, Binary } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SchemaColumn {
  column_name: string;
  data_type: string;
  is_nullable: string | boolean;
  column_default: string | null;
  is_primary_key?: boolean;
  is_unique?: boolean;
}

interface SchemaViewerProps {
  columns: SchemaColumn[];
  isLoading?: boolean;
  tableName?: string;
}

function getTypeIcon(dataType: string) {
  const type = dataType.toLowerCase();
  if (type.includes("int") || type.includes("serial") || type.includes("numeric") || type.includes("float") || type.includes("double")) {
    return Hash;
  }
  if (type.includes("bool")) {
    return ToggleLeft;
  }
  if (type.includes("timestamp") || type.includes("date") || type.includes("time")) {
    return Calendar;
  }
  if (type.includes("uuid")) {
    return Key;
  }
  if (type.includes("json")) {
    return Braces;
  }
  if (type.includes("bytea") || type.includes("binary")) {
    return Binary;
  }
  return Type;
}

function getTypeColor(dataType: string): string {
  const type = dataType.toLowerCase();
  if (type.includes("int") || type.includes("serial") || type.includes("numeric") || type.includes("float")) {
    return "text-blue-400";
  }
  if (type.includes("bool")) {
    return "text-purple-400";
  }
  if (type.includes("timestamp") || type.includes("date") || type.includes("time")) {
    return "text-orange-400";
  }
  if (type.includes("uuid")) {
    return "text-yellow-400";
  }
  if (type.includes("json")) {
    return "text-green-400";
  }
  return "text-muted-foreground";
}

export function SchemaViewer({
  columns,
  isLoading = false,
  tableName,
}: SchemaViewerProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <p className="text-sm">No schema information available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {tableName && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Table: <span className="font-mono text-primary">{tableName}</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {columns.length} column{columns.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <div className="space-y-1">
        {columns.map((col) => {
          const Icon = getTypeIcon(col.data_type);
          const typeColor = getTypeColor(col.data_type);
          const isNullable =
            col.is_nullable === "YES" || col.is_nullable === true;

          return (
            <div
              key={col.column_name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-card hover:bg-accent/30 transition-colors"
            >
              <Icon className={cn("h-4 w-4 shrink-0", typeColor)} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {col.column_name}
                  </span>
                  {col.is_primary_key && (
                    <Badge variant="outline" className="text-xs py-0 px-1.5 border-yellow-500/50 text-yellow-400">
                      PK
                    </Badge>
                  )}
                  {col.is_unique && !col.is_primary_key && (
                    <Badge variant="outline" className="text-xs py-0 px-1.5 border-blue-500/50 text-blue-400">
                      UNIQUE
                    </Badge>
                  )}
                  {!isNullable && (
                    <Badge variant="outline" className="text-xs py-0 px-1.5 border-red-500/30 text-red-400">
                      NOT NULL
                    </Badge>
                  )}
                </div>
                {col.column_default && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Default: <span className="font-mono">{col.column_default}</span>
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <span className={cn("font-mono text-xs", typeColor)}>
                  {col.data_type}
                </span>
                <p className="text-xs text-muted-foreground">
                  {isNullable ? "nullable" : "required"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
