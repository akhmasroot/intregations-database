"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/integrations/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface DocumentCrudProps {
  tableName: string;
  projectId: string;
}

interface DocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  initialData?: Record<string, unknown>;
  mode: "create" | "edit";
}

function DocumentDialog({ open, onClose, onSave, initialData, mode }: DocumentDialogProps) {
  const [jsonValue, setJsonValue] = useState("{}");
  const [isSaving, setIsSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        // Remove system fields for editing
        const { _id, _creationTime, ...editableData } = initialData;
        void _id; void _creationTime;
        setJsonValue(JSON.stringify(editableData, null, 2));
      } else {
        setJsonValue('{\n  "field": "value"\n}');
      }
      setJsonError(null);
    }
  }, [open, mode, initialData]);

  const handleJsonChange = (value: string) => {
    setJsonValue(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  const handleSave = async () => {
    try {
      const data = JSON.parse(jsonValue);
      if (mode === "edit" && initialData?._id) {
        data._id = initialData._id;
      }
      setIsSaving(true);
      await onSave(data);
      onClose();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setJsonError("Invalid JSON format");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add New Document" : "Edit Document"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Enter the document data as JSON."
              : "Edit the document data. System fields (_id, _creationTime) are excluded."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Document Data (JSON)</Label>
          <Textarea
            value={jsonValue}
            onChange={(e) => handleJsonChange(e.target.value)}
            className={`font-mono text-sm min-h-[200px] ${jsonError ? "border-destructive" : ""}`}
            spellCheck={false}
          />
          {jsonError && (
            <p className="text-xs text-destructive">{jsonError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !!jsonError}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : mode === "create" ? (
              "Add Document"
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentCrud({ tableName, projectId }: DocumentCrudProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Record<string, unknown> | undefined>();

  const fetchDocuments = useCallback(async () => {
    if (!tableName || !projectId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        projectId,
        page: page.toString(),
        limit: pageSize.toString(),
      });

      const response = await fetch(
        `/api/integrations/convex/tables/${encodeURIComponent(tableName)}?${params}`
      );
      const result = await response.json();

      if (result.success) {
        setData(result.data.documents ?? []);
        setTotalCount(result.data.totalCount ?? 0);
      } else {
        toast.error(result.error?.message ?? "Failed to fetch documents");
      }
    } catch {
      toast.error("Failed to fetch documents");
    } finally {
      setIsLoading(false);
    }
  }, [tableName, projectId, page, pageSize]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleInsert = async (docData: Record<string, unknown>) => {
    const response = await fetch(
      `/api/integrations/convex/tables/${encodeURIComponent(tableName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, document: docData }),
      }
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message ?? "Insert failed");
    }
    toast.success("Document added");
    fetchDocuments();
  };

  const handleUpdate = async (docData: Record<string, unknown>) => {
    const response = await fetch(
      `/api/integrations/convex/tables/${encodeURIComponent(tableName)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, document: docData }),
      }
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message ?? "Update failed");
    }
    toast.success("Document updated");
    fetchDocuments();
  };

  const handleDelete = async (doc: Record<string, unknown>) => {
    const response = await fetch(
      `/api/integrations/convex/tables/${encodeURIComponent(tableName)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, id: doc._id }),
      }
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message ?? "Delete failed");
    }
    toast.success("Document deleted");
    fetchDocuments();
  };

  // Derive columns from data
  const columns: DataTableColumn[] =
    data.length > 0
      ? Object.keys(data[0]).map((key) => ({
          key,
          label: key,
          sortable: key !== "_id",
        }))
      : [
          { key: "_id", label: "_id" },
          { key: "_creationTime", label: "_creationTime" },
        ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onRefresh={fetchDocuments}
        onAddRow={() => {
          setDialogMode("create");
          setEditingDoc(undefined);
          setDialogOpen(true);
        }}
        onEditRow={(doc) => {
          setDialogMode("edit");
          setEditingDoc(doc);
          setDialogOpen(true);
        }}
        onDeleteRow={handleDelete}
        primaryKey="_id"
      />

      <DocumentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={dialogMode === "create" ? handleInsert : handleUpdate}
        initialData={editingDoc}
        mode={dialogMode}
      />
    </>
  );
}
