"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/integrations/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { SchemaColumn } from "@/components/integrations/schema-viewer";

interface NeonTableCrudProps {
  tableName: string;
  schema?: SchemaColumn[];
}

function RowDialog({ open, onClose, onSave, schema, initialData, mode }: {
  open: boolean; onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void>;
  schema: SchemaColumn[]; initialData?: Record<string, unknown>; mode: "create" | "edit";
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      schema.forEach((col) => {
        if (col.column_name !== "id" && col.column_name !== "created_at") {
          initial[col.column_name] = initialData ? String(initialData[col.column_name] ?? "") : "";
        }
      });
      setFormData(initial);
    }
  }, [open, schema, initialData]);

  const editableColumns = schema.filter((col) => col.column_name !== "id" && col.column_name !== "created_at");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: Record<string, unknown> = {};
      editableColumns.forEach((col) => {
        const val = formData[col.column_name];
        if (val !== "" && val !== undefined) {
          const type = col.data_type.toLowerCase();
          if (type.includes("int") || type === "serial") data[col.column_name] = parseInt(val, 10);
          else if (type.includes("float") || type.includes("numeric") || type.includes("double")) data[col.column_name] = parseFloat(val);
          else if (type === "boolean") data[col.column_name] = val === "true" || val === "1";
          else if (type.includes("json")) { try { data[col.column_name] = JSON.parse(val); } catch { data[col.column_name] = val; } }
          else data[col.column_name] = val;
        } else if (col.is_nullable === "YES") {
          data[col.column_name] = null;
        }
      });
      if (mode === "edit" && initialData?.id !== undefined) data.id = initialData.id;
      await onSave(data);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Row" : "Edit Row"}</DialogTitle>
          <DialogDescription>{mode === "create" ? "Fill in the values for the new row." : "Update the values for this row."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {editableColumns.map((col) => (
            <div key={col.column_name} className="space-y-1.5">
              <Label htmlFor={col.column_name} className="flex items-center gap-2">
                <span className="font-mono">{col.column_name}</span>
                <span className="text-xs text-muted-foreground font-normal">{col.data_type}{col.is_nullable === "NO" ? " · required" : " · optional"}</span>
              </Label>
              <Input id={col.column_name} value={formData[col.column_name] ?? ""} onChange={(e) => setFormData((prev) => ({ ...prev, [col.column_name]: e.target.value }))} placeholder={col.column_default ? `Default: ${col.column_default}` : `Enter ${col.column_name}...`} className="font-mono text-sm" />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : mode === "create" ? "Add Row" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NeonTableCrud({ tableName, schema = [] }: NeonTableCrudProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | undefined>();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString(), ...(searchQuery ? { search: searchQuery } : {}), ...(sortColumn ? { sortBy: sortColumn, sortDir: sortDirection } : {}) });
      const response = await fetch(`/api/integrations/neon/tables/${encodeURIComponent(tableName)}?${params}`);
      const result = await response.json();
      if (result.success) { setData(result.data.rows ?? []); setTotalCount(result.data.totalCount ?? 0); }
      else toast.error(result.error?.message ?? "Failed to fetch data");
    } catch { toast.error("Failed to fetch data"); }
    finally { setIsLoading(false); }
  }, [tableName, page, pageSize, searchQuery, sortColumn, sortDirection]);

  useEffect(() => { if (tableName) fetchData(); }, [fetchData, tableName]);

  const handleInsert = async (rowData: Record<string, unknown>) => {
    const response = await fetch(`/api/integrations/neon/tables/${encodeURIComponent(tableName)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rowData) });
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message ?? "Insert failed");
    toast.success("Row added"); fetchData();
  };

  const handleUpdate = async (rowData: Record<string, unknown>) => {
    const response = await fetch(`/api/integrations/neon/tables/${encodeURIComponent(tableName)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rowData) });
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message ?? "Update failed");
    toast.success("Row updated"); fetchData();
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    const response = await fetch(`/api/integrations/neon/tables/${encodeURIComponent(tableName)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) });
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message ?? "Delete failed");
    toast.success("Row deleted"); fetchData();
  };

  const columns: DataTableColumn[] = schema.map((col) => ({ key: col.column_name, label: col.column_name, type: col.data_type, sortable: true }));
  const effectiveColumns = columns.length > 0 ? columns : data.length > 0 ? Object.keys(data[0]).map((key) => ({ key, label: key, sortable: true })) : [];

  return (
    <>
      <DataTable columns={effectiveColumns} data={data} isLoading={isLoading} totalCount={totalCount} page={page} pageSize={pageSize} onPageChange={setPage} onRefresh={fetchData}
        onAddRow={() => { setDialogMode("create"); setEditingRow(undefined); setDialogOpen(true); }}
        onEditRow={(row) => { setDialogMode("edit"); setEditingRow(row); setDialogOpen(true); }}
        onDeleteRow={handleDelete} onSearch={setSearchQuery} onSort={(col, dir) => { setSortColumn(col); setSortDirection(dir); }} searchQuery={searchQuery} />
      <RowDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSave={dialogMode === "create" ? handleInsert : handleUpdate} schema={schema} initialData={editingRow} mode={dialogMode} />
    </>
  );
}
