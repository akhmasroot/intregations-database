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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const CONVEX_TYPES = [
  { value: "v.string()", label: "String", description: "Text value" },
  { value: "v.number()", label: "Number", description: "Numeric value" },
  { value: "v.boolean()", label: "Boolean", description: "True/false" },
  { value: "v.id()", label: "ID", description: "Reference to another table" },
  { value: "v.array(v.string())", label: "Array<String>", description: "Array of strings" },
  { value: "v.array(v.number())", label: "Array<Number>", description: "Array of numbers" },
  { value: "v.object({})", label: "Object", description: "Nested object" },
  { value: "v.optional(v.string())", label: "Optional String", description: "Optional text" },
  { value: "v.optional(v.number())", label: "Optional Number", description: "Optional number" },
  { value: "v.optional(v.boolean())", label: "Optional Boolean", description: "Optional boolean" },
];

const fieldSchema = z.object({
  name: z.string().min(1, "Field name required").regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Use letters, numbers, underscores"),
  type: z.string().min(1),
  optional: z.boolean(),
});

const collectionSchema = z.object({
  collectionName: z.string().min(1, "Collection name required").regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Use letters, numbers, underscores"),
  fields: z.array(fieldSchema).min(1, "At least one field required"),
});

type CollectionFormData = z.infer<typeof collectionSchema>;

interface TableCreatorProps {
  onTableCreated?: (tableName: string) => void;
  children?: React.ReactNode;
}

function generateSchemaSnippet(data: CollectionFormData): string {
  const fields = data.fields.map((f) => {
    const type = f.optional && !f.type.startsWith("v.optional")
      ? `v.optional(${f.type})`
      : f.type;
    return `    ${f.name}: ${type},`;
  });

  return `// Add to your convex/schema.ts:
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ${data.collectionName}: defineTable({
${fields.join("\n")}
  }),
});`;
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
  } = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      collectionName: "",
      fields: [
        {
          name: "name",
          type: "v.string()",
          optional: false,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "fields",
  });

  const watchedValues = watch();
  const schemaSnippet = generateSchemaSnippet(watchedValues);

  const onSubmit = async (data: CollectionFormData) => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/integrations/convex/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionName: data.collectionName,
          fields: data.fields,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Collection "${data.collectionName}" created!`);
        setOpen(false);
        onTableCreated?.(data.collectionName);
      } else {
        toast.error(result.error?.message ?? "Failed to create collection");
      }
    } catch {
      toast.error("Failed to create collection");
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
            New Collection
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Collection</DialogTitle>
          <DialogDescription>
            Define your Convex collection schema. The{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">_id</code>{" "}
            and{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">
              _creationTime
            </code>{" "}
            fields are added automatically by Convex.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Collection Name */}
          <div className="space-y-1.5">
            <Label htmlFor="collectionName">Collection Name</Label>
            <Input
              id="collectionName"
              placeholder="myCollection"
              {...register("collectionName")}
              className={cn(
                "font-mono",
                errors.collectionName && "border-destructive"
              )}
            />
            {errors.collectionName && (
              <p className="text-xs text-destructive">
                {errors.collectionName.message}
              </p>
            )}
          </div>

          <Separator />

          {/* Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    name: "",
                    type: "v.string()",
                    optional: false,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Field
              </Button>
            </div>

            {/* Auto fields (read-only) */}
            <div className="space-y-2 opacity-60">
              {["_id (auto-generated ID)", "_creationTime (auto timestamp)"].map(
                (f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground font-mono"
                  >
                    {f}
                  </div>
                )
              )}
            </div>

            {/* User fields */}
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-2 items-start p-3 rounded-md border border-border bg-card"
              >
                {/* Name */}
                <div className="col-span-4">
                  <Input
                    placeholder="fieldName"
                    {...register(`fields.${index}.name`)}
                    className={cn(
                      "font-mono text-xs h-8",
                      errors.fields?.[index]?.name && "border-destructive"
                    )}
                  />
                  {errors.fields?.[index]?.name && (
                    <p className="text-xs text-destructive mt-0.5">
                      {errors.fields[index]?.name?.message}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div className="col-span-5">
                  <Select
                    value={watchedValues.fields?.[index]?.type ?? "v.string()"}
                    onValueChange={(val) => setValue(`fields.${index}.type`, val)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONVEX_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div>
                            <div className="font-mono text-xs">{t.value}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Optional toggle */}
                <div className="col-span-2 flex items-center pt-1.5">
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      {...register(`fields.${index}.optional`)}
                      className="rounded"
                    />
                    <span className="text-muted-foreground">Optional</span>
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

          {/* Schema Preview */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? "Hide" : "Show"} Schema Snippet
            </button>
            {showPreview && (
              <pre className="p-3 rounded-md bg-muted/50 border border-border text-xs font-mono overflow-x-auto text-muted-foreground">
                {schemaSnippet}
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
                "Create Collection"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
