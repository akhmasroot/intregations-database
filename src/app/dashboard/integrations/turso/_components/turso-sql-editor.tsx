"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, Loader2, AlertCircle, Clock, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueryResult {
  data: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  error?: string;
}

export function TursoSqlEditor() {
  const [query, setQuery] = useState(
    "SELECT name, type FROM sqlite_master\nWHERE type IN ('table', 'view')\nAND name NOT LIKE 'sqlite_%'\nORDER BY name;"
  );
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runQuery = useCallback(async () => {
    if (!query.trim()) return;

    setIsRunning(true);
    try {
      const response = await fetch("/api/integrations/turso/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          data: data.data.rows ?? [],
          rowCount: data.data.rowCount ?? 0,
          executionTime: data.data.executionTime ?? 0,
        });
      } else {
        setResult({
          data: [],
          rowCount: 0,
          executionTime: 0,
          error: data.error?.message ?? "Query failed",
        });
        toast.error(data.error?.message ?? "Query failed");
      }
    } catch {
      toast.error("Failed to execute query");
    } finally {
      setIsRunning(false);
    }
  }, [query]);

  // Keyboard shortcut: Ctrl+Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runQuery();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runQuery]);

  const exportCSV = () => {
    if (!result?.data.length) return;
    const columns = Object.keys(result.data[0]);
    const headers = columns.join(",");
    const rows = result.data.map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          const str =
            val === null || val === undefined
              ? ""
              : typeof val === "object"
                ? JSON.stringify(val)
                : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "turso-query-result.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = result?.data.length ? Object.keys(result.data[0]) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Editor */}
      <div className="p-4 border-b border-border">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SELECT * FROM your_table LIMIT 10;"
          className="font-mono text-sm min-h-[140px] resize-y bg-muted/30 border-border"
          spellCheck={false}
        />

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>SQLite syntax (Turso is SQLite-compatible)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Ctrl+Enter to run
            </span>
            <Button
              onClick={runQuery}
              disabled={isRunning || !query.trim()}
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Run Query
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {isRunning ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : result ? (
          <>
            {/* Result header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {result.error ? (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Error
                  </span>
                ) : (
                  <>
                    <span>{result.rowCount} rows</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {result.executionTime}ms
                    </span>
                  </>
                )}
              </div>
              {!result.error && result.data.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportCSV}
                  className="h-7 text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export CSV
                </Button>
              )}
            </div>

            {result.error ? (
              <div className="p-4">
                <div className="flex items-start gap-2 p-3 rounded-md border border-red-500/20 bg-red-500/5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">
                      Query Error
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {result.error}
                    </p>
                  </div>
                </div>
              </div>
            ) : result.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">Query returned no results</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="text-xs font-medium">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) => {
                        const val = row[col];
                        const isNull = val === null || val === undefined;
                        const display =
                          isNull
                            ? null
                            : typeof val === "object"
                              ? JSON.stringify(val)
                              : String(val);
                        return (
                          <TableCell
                            key={col}
                            className={cn(
                              "text-xs py-2 max-w-[200px] truncate",
                              isNull && "text-muted-foreground/50 italic"
                            )}
                          >
                            {isNull ? "null" : display}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Play className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">Run a query to see results</p>
            <p className="text-xs mt-1">Press Ctrl+Enter or click Run Query</p>
          </div>
        )}
      </div>
    </div>
  );
}
