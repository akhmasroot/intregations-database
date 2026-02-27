"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentCrud } from "./document-crud";
import { TableCreator } from "./table-creator";
import {
  Layers,
  Search,
  RefreshCw,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConvexProject {
  id: string;
  name: string;
  slug: string;
  deploymentUrl: string;
}

interface ConvexTable {
  name: string;
  documentCount: number;
}

export function ProjectExplorer() {
  const [projects, setProjects] = useState<ConvexProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [tables, setTables] = useState<ConvexTable[]>([]);
  const [filteredTables, setFilteredTables] = useState<ConvexTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("data");

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const response = await fetch("/api/integrations/convex/projects");
      const result = await response.json();

      if (result.success) {
        setProjects(result.data.projects ?? []);
        if (result.data.projects?.length > 0) {
          setSelectedProject(result.data.projects[0].id);
        }
      } else {
        toast.error(result.error?.message ?? "Failed to fetch projects");
      }
    } catch {
      toast.error("Failed to fetch projects");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const fetchTables = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setIsLoadingTables(true);
    try {
      const response = await fetch(
        `/api/integrations/convex/tables?projectId=${projectId}`
      );
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

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProject) {
      fetchTables(selectedProject);
    }
  }, [selectedProject, fetchTables]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredTables(
        tables.filter((t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredTables(tables);
    }
  }, [searchQuery, tables]);

  const currentProject = projects.find((p) => p.id === selectedProject);

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="w-72 border-r border-border flex flex-col bg-card/50">
        {/* Project Selector */}
        <div className="p-3 border-b border-border space-y-2">
          {isLoadingProjects ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {project.slug}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {currentProject && (
            <p className="text-xs text-muted-foreground truncate">
              {currentProject.deploymentUrl}
            </p>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Table List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingTables ? (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">
                {searchQuery ? "No tables match" : "No tables found"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredTables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => {
                    setSelectedTable(table.name);
                    setActiveTab("data");
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors text-left",
                    selectedTable === table.name
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate font-mono text-xs">
                    {table.name}
                  </span>
                  {table.documentCount > 0 && (
                    <span className="text-xs text-muted-foreground/60">
                      {table.documentCount.toLocaleString()}
                    </span>
                  )}
                  {selectedTable === table.name && (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => selectedProject && fetchTables(selectedProject)}
            title="Refresh tables"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <TableCreator
            onTableCreated={(name) => {
              if (selectedProject) fetchTables(selectedProject);
              setSelectedTable(name);
            }}
          >
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
              + New Collection
            </Button>
          </TableCreator>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTable ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">
                {selectedTable}
              </span>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="data" className="text-xs">
                  Documents
                </TabsTrigger>
                <TabsTrigger value="schema" className="text-xs">
                  Schema
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="data"
                className="flex-1 overflow-hidden mt-0 p-0"
              >
                <DocumentCrud
                  tableName={selectedTable}
                  projectId={selectedProject}
                />
              </TabsContent>

              <TabsContent
                value="schema"
                className="flex-1 overflow-auto mt-0 p-4"
              >
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Convex uses dynamic schemas. Documents in this collection
                    may have varying fields.
                  </p>
                  <div className="p-3 rounded-md border border-border bg-muted/20">
                    <p className="text-xs font-mono text-muted-foreground">
                      {"// Convex schema definition"}
                    </p>
                    <pre className="text-xs font-mono mt-2 text-foreground whitespace-pre-wrap">
                      {`{
  _id: v.id("${selectedTable}"),
  _creationTime: v.number(),
  // ... your fields
}`}
                    </pre>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    To define a strict schema, add this collection to your{" "}
                    <code className="font-mono bg-muted px-1 rounded">
                      convex/schema.ts
                    </code>{" "}
                    file.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Layers className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">Select a collection to explore</p>
            <p className="text-xs mt-1">
              Choose a collection from the left panel to view and manage documents
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
