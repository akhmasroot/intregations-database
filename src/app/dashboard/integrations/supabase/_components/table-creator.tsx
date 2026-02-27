"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ColumnTypeSelector, type ColumnType } from "@/components/integrations/column-type-selector";
import { Plus, Trash2, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const columnSchema = z.object({
  name: z.string().min(1, "Column name required").regex(/^[a-z_][a-z0-9_]*$/, "Use lowercase letters, numbers, underscores"),
  type: z.string().min(1),
  nullable: z.boolean(),
  defaultValue: z.string().optional(),
  isPrimary: z.boolean(),
  isUnique: z.boolean(),
});

const tableSchema = z.object({
  tableName: z.string().min(1, "Table name required").regex(/^[a-z_][a-z0-9_]*$/, "Use lowercase letters, numbers, underscores"),
  columns: z.array(columnSchema).min(1, "At least one column required"),
});

type TableFormData = z.infer<typeof tableSchema>;

interface TableCreatorProps {
  onTableCreated?: (tableName: string) => void;
  children?: React.ReactNode;
}

function generateSQL(data: TableFormData): string {
  const cols = [
    // Auto-generated columns
    `  id uuid PRIMARY KEY DEFAULT uuid_generate_v4()`,
    `  created_at timestamptz DEFAULT now()`,
    // User-defined columns
    ...data.columns.map((col) => {
      const parts = [`  ${col.name} ${col.type}`];
      if (!col.nullable) parts.push("NOT NULL");
      if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
      if (col.isUnique && !col.isPrimary) parts.push("UNIQUE");
      return parts.join(" ");
    }),
  ];

  return `CREATE TABLE ${data.tableName} (\n${cols.join(",\n")}\n);`;
}

export function TableCreator({ onTableCreated, children }: TableCreatorProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      tableName: "",
      columns: [
        {
          name: "name",
          type: "text",
          nullable: false,
          defaultValue: "",
          isPrimary: false,
          isUnique: false,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "columns",
  });

  const watchedValues = watch();
  const previewSQL = generateSQL(watchedValues);

  const onSubmit = async (data: TableFormData) => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/integrations/supabase/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: data.tableName,
          columns: data.columns,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.data?.manualRequired) {
          // Show the SQL for manual execution
          toast.info(
            `Auto-creation failed. Please run this SQL in your Supabase SQL Editor:\n\n${result.data.sql}`,
            { duration: 10000 }
          );
          // Copy SQL to clipboard
          if (result.data.sql) {
            navigator.clipboard.writeText(result.data.sql).catch(() => {});
            toast.success("SQL copied to clipboard! Paste it in Supabase SQL Editor.");
          }
          setOpen(false);
        } else {
          toast.success(`Table "${data.tableName}" created successfully!`);
          setOpen(false);
          onTableCreated?.(data.tableName);
        }
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
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Table
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Define your table structure. An{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">id</code>{" "}
            (UUID) and{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              created_at
            </code>{" "}
            column will be added automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Table Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              placeholder="my_table"
              {...register("tableName")}
              className={cn(
                "font-mono",
                errors.tableName && "border-destructive"
              )}
            />
            {errors.tableName && (
              <p className="text-xs text-destructive">
                {errors.tableName.message}
              </p>
            )}
          </div>

          <Separator />

          {/* Columns */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Columns</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    name: "",
                    type: "text",
                    nullable: true,
                    defaultValue: "",
                    isPrimary: false,
                    isUnique: false,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Column
              </Button>
            </div>

            {/* Auto columns (read-only) */}
            <div className="space-y-2 opacity-60">
              {["id (uuid, primary key, auto)", "created_at (timestamptz, auto)"].map(
                (col) => (
                  <div
                    key={col}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground font-mono"
                  >
                    {col}
                  </div>
                )
              )}
            </div>

            {/* User columns */}
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-2 items-start p-3 rounded-md border border-border bg-card"
              >
                {/* Name */}
                <div className="col-span-3">
                  <Input
                    placeholder="column_name"
                    {...register(`columns.${index}.name`)}
                    className={cn(
                      "font-mono text-xs h-8",
                      errors.columns?.[index]?.name && "border-destructive"
                    )}
                  />
                  {errors.columns?.[index]?.name && (
                    <p className="text-xs text-destructive mt-0.5">
                      {errors.columns[index]?.name?.message}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div className="col-span-3">
                  <ColumnTypeSelector
                    value={(watchedValues.columns?.[index]?.type as ColumnType) ?? "text"}
                    onChange={(val) => setValue(`columns.${index}.type`, val)}
                  />
                </div>

                {/* Default */}
                <div className="col-span-3">
                  <Input
                    placeholder="default value"
                    {...register(`columns.${index}.defaultValue`)}
                    className="text-xs h-8 font-mono"
                  />
                </div>

                {/* Toggles */}
                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      {...register(`columns.${index}.nullable`)}
                      className="rounded"
                    />
                    <span className="text-muted-foreground">Null</span>
                  </label>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      {...register(`columns.${index}.isUnique`)}
                      className="rounded"
                    />
                    <span className="text-muted-foreground">Uniq</span>
                  </label>
                </div>

                {/* Delete */}
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* SQL Preview */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? "Hide" : "Show"} SQL Preview
            </button>
            {showPreview && (
              <pre className="p-3 rounded-md bg-muted/50 border border-border text-xs font-mono overflow-x-auto text-muted-foreground">
                {previewSQL}
              </pre>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Table"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
