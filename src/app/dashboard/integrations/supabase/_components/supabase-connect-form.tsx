"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Eye, EyeOff, Loader2, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";

const apiKeySchema = z.object({
  projectUrl: z
    .string()
    .url("Must be a valid URL")
    .refine((url) => url.includes(".supabase.co"), {
      message: "Must be a Supabase project URL (*.supabase.co)",
    }),
  anonKey: z.string().min(1, "Anon key is required"),
  serviceKey: z.string().optional(),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

interface SupabaseConnectFormProps {
  onConnected?: () => void;
}

export function SupabaseConnectForm({ onConnected }: SupabaseConnectFormProps) {
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceKey, setShowServiceKey] = useState(false);
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
  } = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
  });

  const handleTestConnection = async () => {
    const values = getValues();
    if (!values.projectUrl || !values.anonKey) {
      toast.error("Please fill in the Project URL and Anon Key first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/integrations/supabase/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectUrl: values.projectUrl,
          anonKey: values.anonKey,
          serviceKey: values.serviceKey,
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

  const onSubmit = async (data: ApiKeyFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/integrations/supabase/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectUrl: data.projectUrl,
          anonKey: data.anonKey,
          serviceKey: data.serviceKey,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Supabase connected successfully!");
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

  const handleOAuthConnect = () => {
    window.location.href = "/api/integrations/supabase/oauth/authorize";
  };

  return (
    <Tabs defaultValue="apikey" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="oauth">OAuth (Recommended)</TabsTrigger>
        <TabsTrigger value="apikey">API Key (Manual)</TabsTrigger>
      </TabsList>

      {/* OAuth Tab */}
      <TabsContent value="oauth">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect with OAuth</CardTitle>
            <CardDescription>
              Authorize this app to access your Supabase projects securely
              without sharing API keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-sm text-blue-300 font-medium mb-2">
                Requirements
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• You need a Supabase OAuth App configured</li>
                <li>
                  • Register at:{" "}
                  <a
                    href="https://supabase.com/dashboard/org/oauth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    supabase.com/dashboard/org/oauth
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  • Set{" "}
                  <code className="font-mono bg-muted px-1 rounded">
                    SUPABASE_CLIENT_ID
                  </code>{" "}
                  and{" "}
                  <code className="font-mono bg-muted px-1 rounded">
                    SUPABASE_CLIENT_SECRET
                  </code>{" "}
                  in your environment
                </li>
              </ul>
            </div>

            <Button
              onClick={handleOAuthConnect}
              className="w-full"
              size="lg"
            >
              <svg
                className="h-4 w-4 mr-2"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z" />
              </svg>
              Connect with Supabase
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* API Key Tab */}
      <TabsContent value="apikey">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual API Key Setup</CardTitle>
            <CardDescription>
              Enter your Supabase project credentials directly. Find these in
              your Supabase project settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Project URL */}
              <div className="space-y-1.5">
                <Label htmlFor="projectUrl">Project URL</Label>
                <Input
                  id="projectUrl"
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  {...register("projectUrl")}
                  className={errors.projectUrl ? "border-destructive" : ""}
                />
                {errors.projectUrl && (
                  <p className="text-xs text-destructive">
                    {errors.projectUrl.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Found in: Project Settings → API → Project URL
                </p>
              </div>

              {/* Anon Key */}
              <div className="space-y-1.5">
                <Label htmlFor="anonKey">Anon Key (Public)</Label>
                <div className="relative">
                  <Input
                    id="anonKey"
                    type={showAnonKey ? "text" : "password"}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    {...register("anonKey")}
                    className={`pr-10 ${errors.anonKey ? "border-destructive" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnonKey(!showAnonKey)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showAnonKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.anonKey && (
                  <p className="text-xs text-destructive">
                    {errors.anonKey.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Found in: Project Settings → API → Project API Keys → anon
                </p>
              </div>

              {/* Service Role Key */}
              <div className="space-y-1.5">
                <Label htmlFor="serviceKey">
                  Service Role Key{" "}
                  <span className="text-muted-foreground font-normal">
                    (Optional)
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    id="serviceKey"
                    type={showServiceKey ? "text" : "password"}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    {...register("serviceKey")}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowServiceKey(!showServiceKey)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showServiceKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-md border border-yellow-500/20 bg-yellow-500/5">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-300">
                    <strong>Warning:</strong> The Service Role Key bypasses Row
                    Level Security and has full database access. Only provide
                    this if you need admin operations.
                  </p>
                </div>
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
                  className="flex-1"
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
      </TabsContent>
    </Tabs>
  );
}
