"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Loader2, ExternalLink, CheckCircle2, AlertTriangle, Database } from "lucide-react";

const neonSchema = z.object({
  connectionString: z
    .string()
    .min(1, "Connection string is required")
    .refine(
      (s) => s.startsWith("postgresql://") || s.startsWith("postgres://"),
      { message: "Must be a valid PostgreSQL connection string (postgresql://...)" }
    ),
  databaseName: z.string().optional(),
});

type NeonFormData = z.infer<typeof neonSchema>;

interface NeonConnectFormProps {
  onConnected?: () => void;
}

export function NeonConnectForm({ onConnected }: NeonConnectFormProps) {
  const [showConnString, setShowConnString] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<NeonFormData>({
    resolver: zodResolver(neonSchema),
  });

  const handleTestConnection = async () => {
    const values = getValues();
    if (!values.connectionString) {
      toast.error("Please fill in the connection string first");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/integrations/neon/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, testOnly: true }),
      });
      const data = await response.json();
      if (data.success) {
        setTestResult({ success: true, message: "Connection successful!" });
        toast.success("Connection test passed!");
      } else {
        setTestResult({ success: false, message: data.error?.message ?? "Connection failed" });
        toast.error(data.error?.message ?? "Connection test failed");
      }
    } catch {
      setTestResult({ success: false, message: "Network error" });
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const onSubmit = async (data: NeonFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/integrations/neon/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Neon connected successfully!");
        onConnected?.();
      } else {
        toast.error(result.error?.message ?? "Failed to save connection");
      }
    } catch {
      toast.error("Failed to save connection");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-green-500/10">
            <Database className="h-4 w-4 text-green-400" />
          </div>
          Connect Your Neon Database
        </CardTitle>
        <CardDescription>
          Enter your Neon PostgreSQL connection string. Find it in your{" "}
          <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline inline-flex items-center gap-1">
            Neon console <ExternalLink className="h-3 w-3" />
          </a>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Connection String */}
          <div className="space-y-1.5">
            <Label htmlFor="connectionString">Connection String</Label>
            <div className="relative">
              {showConnString ? (
                <Textarea
                  id="connectionString"
                  placeholder="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
                  {...register("connectionString")}
                  className={`font-mono text-xs min-h-[80px] pr-10 ${errors.connectionString ? "border-destructive" : ""}`}
                />
              ) : (
                <Input
                  id="connectionString"
                  type="password"
                  placeholder="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
                  {...register("connectionString")}
                  className={`font-mono text-xs pr-10 ${errors.connectionString ? "border-destructive" : ""}`}
                />
              )}
              <button
                type="button"
                onClick={() => setShowConnString(!showConnString)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showConnString ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.connectionString && <p className="text-xs text-destructive">{errors.connectionString.message}</p>}
            <p className="text-xs text-muted-foreground">Found in: Neon Console → Your Project → Connection Details → Connection string</p>
          </div>

          {/* Database Name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="databaseName">Database Name <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Input id="databaseName" placeholder="neondb" {...register("databaseName")} className="font-mono" />
          </div>

          {/* How to get credentials */}
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <p className="text-sm text-green-300 font-medium mb-2">How to get your connection string</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">console.neon.tech</a></li>
              <li>Select your project</li>
              <li>Click &quot;Connection Details&quot;</li>
              <li>Copy the &quot;Connection string&quot; (includes password)</li>
            </ol>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-md border text-sm ${testResult.success ? "border-green-500/20 bg-green-500/5 text-green-400" : "border-red-500/20 bg-red-500/5 text-red-400"}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting || isSaving} className="flex-1">
              {isTesting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testing...</> : "Test Connection"}
            </Button>
            <Button type="submit" disabled={isTesting || isSaving} className="flex-1 bg-green-600 hover:bg-green-700">
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save & Connect"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
