"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Database,
} from "lucide-react";

const tursoSchema = z.object({
  databaseUrl: z
    .string()
    .min(1, "Database URL is required")
    .refine(
      (url) =>
        url.startsWith("libsql://") ||
        url.startsWith("https://") ||
        url.startsWith("file:"),
      {
        message:
          "Must be a valid Turso URL (libsql://xxx.turso.io or https://xxx.turso.io)",
      }
    ),
  authToken: z.string().min(1, "Auth token is required"),
  databaseName: z.string().optional(),
});

type TursoFormData = z.infer<typeof tursoSchema>;

interface TursoConnectFormProps {
  onConnected?: () => void;
}

export function TursoConnectForm({ onConnected }: TursoConnectFormProps) {
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<TursoFormData>({
    resolver: zodResolver(tursoSchema),
  });

  const handleTestConnection = async () => {
    const values = getValues();
    if (!values.databaseUrl || !values.authToken) {
      toast.error("Please fill in the Database URL and Auth Token first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/integrations/turso/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseUrl: values.databaseUrl,
          authToken: values.authToken,
          testOnly: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({ success: true, message: "Connection successful!" });
        toast.success("Connection test passed!");
      } else {
        setTestResult({
          success: false,
          message: data.error?.message ?? "Connection failed",
        });
        toast.error(data.error?.message ?? "Connection test failed");
      }
    } catch {
      setTestResult({ success: false, message: "Network error" });
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const onSubmit = async (data: TursoFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/integrations/turso/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseUrl: data.databaseUrl,
          authToken: data.authToken,
          databaseName: data.databaseName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Turso connected successfully!");
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
          <div className="p-1.5 rounded-md bg-cyan-500/10">
            <Database className="h-4 w-4 text-cyan-400" />
          </div>
          Connect Your Turso Database
        </CardTitle>
        <CardDescription>
          Enter your Turso database URL and auth token. Find these in your{" "}
          <a
            href="https://app.turso.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline inline-flex items-center gap-1"
          >
            Turso dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Database URL */}
          <div className="space-y-1.5">
            <Label htmlFor="databaseUrl">Database URL</Label>
            <Input
              id="databaseUrl"
              placeholder="libsql://your-database-name.turso.io"
              {...register("databaseUrl")}
              className={errors.databaseUrl ? "border-destructive" : ""}
            />
            {errors.databaseUrl && (
              <p className="text-xs text-destructive">
                {errors.databaseUrl.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Found in: Turso Dashboard → Your Database → Connect → URL
            </p>
          </div>

          {/* Auth Token */}
          <div className="space-y-1.5">
            <Label htmlFor="authToken">Auth Token</Label>
            <div className="relative">
              <Input
                id="authToken"
                type={showToken ? "text" : "password"}
                placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
                {...register("authToken")}
                className={`pr-10 ${errors.authToken ? "border-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.authToken && (
              <p className="text-xs text-destructive">
                {errors.authToken.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Found in: Turso Dashboard → Your Database → Connect → Auth Token
            </p>
          </div>

          {/* Database Name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="databaseName">
              Database Name{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </Label>
            <Input
              id="databaseName"
              placeholder="my-database"
              {...register("databaseName")}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this database
            </p>
          </div>

          {/* How to get credentials */}
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-sm text-cyan-300 font-medium mb-2">
              How to get your credentials
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://app.turso.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  app.turso.tech
                </a>
              </li>
              <li>Select your database</li>
              <li>Click &quot;Connect&quot; tab</li>
              <li>Copy the URL and generate an Auth Token</li>
            </ol>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md border text-sm ${
                testResult.success
                  ? "border-green-500/20 bg-green-500/5 text-green-400"
                  : "border-red-500/20 bg-red-500/5 text-red-400"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || isSaving}
              className="flex-1"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button
              type="submit"
              disabled={isTesting || isSaving}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Connect"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
