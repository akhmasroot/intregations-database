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

const psSchema = z.object({
  host: z
    .string()
    .min(1, "Host is required")
    .refine((h) => h.includes(".psdb.cloud") || h.includes("planetscale"), {
      message: "Must be a valid PlanetScale host (e.g. aws.connect.psdb.cloud)",
    }),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  databaseName: z.string().optional(),
});

type PSFormData = z.infer<typeof psSchema>;

interface PlanetScaleConnectFormProps {
  onConnected?: () => void;
}

export function PlanetScaleConnectForm({ onConnected }: PlanetScaleConnectFormProps) {
  const [showPassword, setShowPassword] = useState(false);
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
  } = useForm<PSFormData>({
    resolver: zodResolver(psSchema),
  });

  const handleTestConnection = async () => {
    const values = getValues();
    if (!values.host || !values.username || !values.password) {
      toast.error("Please fill in all required fields first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/integrations/planetscale/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, testOnly: true }),
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

  const onSubmit = async (data: PSFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/integrations/planetscale/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("PlanetScale connected successfully!");
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
          <div className="p-1.5 rounded-md bg-purple-500/10">
            <Database className="h-4 w-4 text-purple-400" />
          </div>
          Connect Your PlanetScale Database
        </CardTitle>
        <CardDescription>
          Enter your PlanetScale database credentials. Find these in your{" "}
          <a
            href="https://app.planetscale.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline inline-flex items-center gap-1"
          >
            PlanetScale dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Host */}
          <div className="space-y-1.5">
            <Label htmlFor="host">Host</Label>
            <Input
              id="host"
              placeholder="aws.connect.psdb.cloud"
              {...register("host")}
              className={errors.host ? "border-destructive" : ""}
            />
            {errors.host && (
              <p className="text-xs text-destructive">{errors.host.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Found in: PlanetScale Dashboard → Your Database → Connect → Host
            </p>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="your-username"
              {...register("username")}
              className={`font-mono ${errors.username ? "border-destructive" : ""}`}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="pscale_pw_xxxxxxxxxxxxxxxx"
                {...register("password")}
                className={`pr-10 font-mono ${errors.password ? "border-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Found in: PlanetScale Dashboard → Your Database → Connect → Password
            </p>
          </div>

          {/* Database Name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="databaseName">
              Database Name{" "}
              <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="databaseName"
              placeholder="my-database"
              {...register("databaseName")}
              className="font-mono"
            />
          </div>

          {/* How to get credentials */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
            <p className="text-sm text-purple-300 font-medium mb-2">
              How to get your credentials
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://app.planetscale.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline"
                >
                  app.planetscale.com
                </a>
              </li>
              <li>Select your database</li>
              <li>Click &quot;Connect&quot; button</li>
              <li>Select &quot;Connect with: @planetscale/database&quot;</li>
              <li>Copy Host, Username, and Password</li>
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
              className="flex-1 bg-purple-600 hover:bg-purple-700"
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
