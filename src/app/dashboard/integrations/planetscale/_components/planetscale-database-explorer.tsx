"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SchemaViewer, type SchemaColumn } from "@/components/integrations/schema-viewer";
import { PlanetScaleTableCrud } from "./planetscale-table-crud";
import { PlanetScaleTableCreator } from "./planetscale-table-creator";
import { PlanetScaleSqlEditor } from "./planetscale-sql-editor";
import { Table2, Search, RefreshCw, Database, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableInfo {
  name: string;
  type: string;
  rowCount: number;
}

export function PlanetScaleDatabaseExplorer() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [filteredTables, setFilteredTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<SchemaColumn[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("data");

  const fetchTables = useCallback(async () => {
    setIsLoadingTables(true);
    try {
      const response = await fetch("/api/integrations/planetscale/tables");
      const result = await response.json();
      if (result.success) {
        setTables(result.data.tables ?? []);
        setFilteredTables(result.data.tables ?? []);
      } else {
        toast.error(result.error?.message ?? "Failed to fetch tables");
      }
    } catch {
      toast.error("Failed to fetch tables");
    } finally {
      setIsLoadingTables(false);
    }
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredTables(tables.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase())));
    } else {
      setFilteredTables(tables);
    }
  }, [searchQuery, tables]);

  const fetchSchema = useCallback(async (tableName: string) => {
    setIsLoadingSchema(true);
    try {
      const response = await fetch(`/api/integrations/planetscale/schema?table=${encodeURIComponent(tableName)}`);
      const result = await response.json();
      if (result.success) {
        setTableSchema(result.data.columns ?? []);
      } else {
        toast.error(result.error?.message ?? "Failed to fetch schema");
      }
    } catch {
      toast.error("Failed to fetch schema");
    } finally {
      setIsLoadingSchema(false);
    }
  }, []);

  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    setActiveTab("data");
    fetchSchema(tableName);
  };

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="w-72 border-r border-border flex flex-col bg-card/50">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search tables..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingTables ? (
            <div className="space-y-1.5 p-1">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Database className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">{searchQuery ? "No tables match" : "No tables found"}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredTables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => handleSelectTable(table.name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors text-left",
                    selectedTable === table.name ? "bg-purple-500/10 text-purple-300" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Table2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate font-mono text-xs">{table.name}</span>
                  {table.rowCount > 0 && <span className="text-xs text-muted-foreground/60">{table.rowCount.toLocaleString()}</span>}
                  {selectedTable === table.name && <ChevronRight className="h-3 w-3 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchTables} title="Refresh tables">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <PlanetScaleTableCreator onTableCreated={(name) => { fetchTables(); handleSelectTable(name); }}>
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />New Table
            </Button>
          </PlanetScaleTableCreator>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTable ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Table2 className="h-4 w-4 text-purple-400" />
              <span className="font-mono text-sm font-medium">{selectedTable}</span>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="data" className="text-xs">Data</TabsTrigger>
                <TabsTrigger value="schema" className="text-xs">Schema</TabsTrigger>
                <TabsTrigger value="sql" className="text-xs">SQL Editor</TabsTrigger>
              </TabsList>
              <TabsContent value="data" className="flex-1 overflow-hidden mt-0 p-0">
                <PlanetScaleTableCrud tableName={selectedTable} schema={tableSchema} />
              </TabsContent>
              <TabsContent value="schema" className="flex-1 overflow-auto mt-0">
                <SchemaViewer columns={tableSchema} isLoading={isLoadingSchema} tableName={selectedTable} />
              </TabsContent>
              <TabsContent value="sql" className="flex-1 overflow-hidden mt-0 p-0">
                <PlanetScaleSqlEditor />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Database className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">Select a table to explore</p>
            <p className="text-xs mt-1">Choose a table from the left panel to view and manage data</p>
          </div>
        )}
      </div>
    </div>
  );
}
