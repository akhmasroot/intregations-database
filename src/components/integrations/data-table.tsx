"use client";

import { useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  RefreshCw,
  Download,
  Search,
  Plus,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn {
  key: string;
  label: string;
  type?: string;
  sortable?: boolean;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  data: Record<string, unknown>[];
  isLoading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRefresh?: () => void;
  onAddRow?: () => void;
  onEditRow?: (row: Record<string, unknown>) => void;
  onDeleteRow?: (row: Record<string, unknown>) => Promise<void>;
  onSearch?: (query: string) => void;
  onSort?: (column: string, direction: "asc" | "desc") => void;
  primaryKey?: string;
  searchQuery?: string;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function truncate(str: string, maxLength = 100): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function DataTable({
  columns,
  data,
  isLoading = false,
  totalCount = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
  onRefresh,
  onAddRow,
  onEditRow,
  onDeleteRow,
  onSearch,
  onSort,
  primaryKey = "id",
  searchQuery = "",
}: DataTableProps) {
  const [deletingRow, setDeletingRow] = useState<Record<string, unknown> | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = useCallback(
    (column: string) => {
      const newDirection =
        sortColumn === column && sortDirection === "asc" ? "desc" : "asc";
      setSortColumn(column);
      setSortDirection(newDirection);
      onSort?.(column, newDirection);
    },
    [sortColumn, sortDirection, onSort]
  );

  const handleDelete = async (row: Record<string, unknown>) => {
    if (onDeleteRow) {
      await onDeleteRow(row);
    }
    setDeletingRow(null);
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearch?.(value);
  };

  const exportCSV = () => {
    const headers = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const val = formatCellValue(row[col.key]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-border">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="h-8"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Export</span>
          </Button>
          {onAddRow && (
            <Button size="sm" onClick={onAddRow} className="h-8">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Add Row</span>
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-medium">No data found</p>
            <p className="text-xs mt-1">
              {localSearch
                ? "Try adjusting your search query"
                : "This table is empty"}
            </p>
            {onAddRow && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddRow}
                className="mt-3"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add first row
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "text-xs font-medium",
                      col.sortable && "cursor-pointer select-none hover:text-foreground"
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <ArrowUpDown
                          className={cn(
                            "h-3 w-3",
                            sortColumn === col.key
                              ? "text-foreground"
                              : "text-muted-foreground/50"
                          )}
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
                {(onEditRow || onDeleteRow) && (
                  <TableHead className="w-20 text-xs">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="cursor-pointer"
                  onDoubleClick={() => onEditRow?.(row)}
                >
                  {columns.map((col) => {
                    const value = formatCellValue(row[col.key]);
                    const isNull = row[col.key] === null || row[col.key] === undefined;
                    return (
                      <TableCell
                        key={col.key}
                        className="text-xs py-2 max-w-[200px]"
                      >
                        {isNull ? (
                          <span className="text-muted-foreground/50 italic">
                            null
                          </span>
                        ) : (
                          <span title={value}>{truncate(value)}</span>
                        )}
                      </TableCell>
                    );
                  })}
                  {(onEditRow || onDeleteRow) && (
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        {onDeleteRow && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingRow(row);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Row</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this row? This
                                  action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(row)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, totalCount)} of {totalCount} rows
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
