"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const PG_TYPES = [
  { value: "text", label: "text", description: "Variable-length string" },
  { value: "varchar(255)", label: "varchar(255)", description: "Limited string" },
  { value: "integer", label: "integer", description: "32-bit integer" },
  { value: "bigint", label: "bigint", description: "64-bit integer" },
  { value: "numeric", label: "numeric", description: "Exact decimal" },
  { value: "float", label: "float", description: "Floating-point" },
  { value: "boolean", label: "boolean", description: "True/false" },
  { value: "timestamp", label: "timestamp", description: "Date and time" },
  { value: "timestamptz", label: "timestamptz", description: "Timestamp with timezone" },
  { value: "uuid", label: "uuid", description: "UUID" },
  { value: "jsonb", label: "jsonb", description: "Binary JSON" },
  { value: "serial", label: "serial", description: "Auto-increment integer" },
];

const columnSchema = z.object({
  name: z.string().min(1, "Column name required").regex(/^[a-z_][a-z0-9_]*$/, "Use lowercase letters, numbers, underscores"),
  type: z.string().min(1),
  nullable: z.boolean(),
  defaultValue: z.string().optional(),
  isUnique: z.boolean(),
});

const tableSchema = z.object({
  tableName: z.string().min(1, "Table name required").regex(/^[a-z_][a-z0-9_]*$/, "Use lowercase letters, numbers, underscores"),
  columns: z.array(columnSchema).min(1, "At least one column required"),
});

type TableFormData = z.infer<typeof tableSchema>;

interface NeonTableCreatorProps {
  onTableCreated?: (tableName: string) => void;
  children?: React.ReactNode;
}

function generateSQL(data: TableFormData): string {
  const cols = [
    `  id uuid PRIMARY KEY DEFAULT gen_random_uuid()`,
    `  created_at timestamptz DEFAULT now()`,
    ...data.columns.map((col) => {
      const parts = [`  "${col.name}" ${col.type}`];
      if (!col.nullable) parts.push("NOT NULL");
      if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
      if (col.isUnique) parts.push("UNIQUE");
      return parts.join(" ");
    }),
  ];
  return `CREATE TABLE "${data.tableName}" (\n${cols.join(",\n")}\n);`;
}

export function NeonTableCreator({ onTableCreated, children }: NeonTableCreatorProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: { tableName: "", columns: [{ name: "name", type: "text", nullable: false, defaultValue: "", isUnique: false }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "columns" });
  const watchedValues = watch();
  const previewSQL = generateSQL(watchedValues);

  const onSubmit = async (data: TableFormData) => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/integrations/neon/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: data.tableName, columns: data.columns }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Table "${data.tableName}" created!`);
        setOpen(false);
        onTableCreated?.(data.tableName);
      } else {
        toast.error(result.error?.message ?? "Failed to create table");
      }
    } catch {
      toast.error("Failed to create table");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children ?? <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Table</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>Define your PostgreSQL table structure. An <code className="font-mono text-xs bg-muted px-1 rounded">id</code> (UUID) and <code className="font-mono text-xs bg-muted px-1 rounded">created_at</code> column will be added automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tableName">Table Name</Label>
            <Input id="tableName" placeholder="my_table" {...register("tableName")} className={cn("font-mono", errors.tableName && "border-destructive")} />
            {errors.tableName && <p className="text-xs text-destructive">{errors.tableName.message}</p>}
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", type: "text", nullable: true, defaultValue: "", isUnique: false })}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Column
              </Button>
            </div>
            <div className="space-y-2 opacity-60">
              {["id (uuid, primary key, auto)", "created_at (timestamptz, auto)"].map((col) => (
                <div key={col} className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground font-mono">{col}</div>
              ))}
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-3 rounded-md border border-border bg-card">
                <div className="col-span-3"><Input placeholder="column_name" {...register(`columns.${index}.name`)} className={cn("font-mono text-xs h-8", errors.columns?.[index]?.name && "border-destructive")} /></div>
                <div className="col-span-3">
                  <Select value={watchedValues.columns?.[index]?.type ?? "text"} onValueChange={(val) => setValue(`columns.${index}.type`, val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}><div><div className="font-mono text-xs font-medium">{t.label}</div><div className="text-xs text-muted-foreground">{t.description}</div></div></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3"><Input placeholder="default value" {...register(`columns.${index}.defaultValue`)} className="text-xs h-8 font-mono" /></div>
                <div className="col-span-2 flex items-center gap-2 pt-1.5">
                  <label className="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" {...register(`columns.${index}.nullable`)} className="rounded" /><span className="text-muted-foreground">Null</span></label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" {...register(`columns.${index}.isUnique`)} className="rounded" /><span className="text-muted-foreground">Uniq</span></label>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(index)} disabled={fields.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <button type="button" onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Eye className="h-3.5 w-3.5" />{showPreview ? "Hide" : "Show"} SQL Preview
            </button>
            {showPreview && <pre className="p-3 rounded-md bg-muted/50 border border-border text-xs font-mono overflow-x-auto text-muted-foreground">{previewSQL}</pre>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isCreating} className="bg-green-600 hover:bg-green-700">
              {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
