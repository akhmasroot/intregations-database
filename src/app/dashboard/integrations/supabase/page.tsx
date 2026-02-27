import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/integrations/auth-check";
import { IntegrationSidebar } from "@/components/integrations/integration-sidebar";
import { ConnectionStatusBadge } from "@/components/integrations/connection-status-badge";
import { SupabaseConnectForm } from "./_components/supabase-connect-form";
import { DatabaseExplorer } from "./_components/database-explorer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Database, ExternalLink } from "lucide-react";

async function getSupabaseIntegration(userId: string) {
  return db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "supabase",
      },
    },
    select: {
      id: true,
      isActive: true,
      connectedAt: true,
      supabaseProjectRef: true,
      supabaseServiceKey: true,
      supabaseUrl: true,
      supabaseAnonKey: true,
    },
  });
}

export default async function SupabaseDashboardPage() {
  const userId = await getCurrentUserId();
  const integration = userId ? await getSupabaseIntegration(userId) : null;
  const isConnected = !!integration?.isActive;
  const hasServiceKey = !!integration?.supabaseServiceKey;
  // Check if credentials are fully configured (URL + key required for API calls)
  const isFullyConfigured = isConnected && !!integration?.supabaseUrl && !!integration?.supabaseAnonKey;

  return (
    <div className="flex min-h-screen bg-background dark">
      <IntegrationSidebar supabaseConnected={isFullyConfigured} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href="/dashboard/integrations">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald-500/10">
                <Database className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Supabase</h1>
                {integration?.supabaseProjectRef && (
                  <p className="text-xs text-muted-foreground">
                    {integration.supabaseProjectRef}
                  </p>
                )}
              </div>
            </div>
            <ConnectionStatusBadge
              status={isFullyConfigured ? "connected" : isConnected ? "connecting" : "disconnected"}
            />
          </div>

          <div className="flex items-center gap-2">
            {isFullyConfigured && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open Supabase
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isFullyConfigured ? (
            <DatabaseExplorer hasServiceKey={hasServiceKey} />
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="w-full max-w-lg">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 rounded-full bg-emerald-500/10 mb-4">
                    <Database className="h-8 w-8 text-emerald-400" />
                  </div>
                  {isConnected && !isFullyConfigured ? (
                    <>
                      <h2 className="text-xl font-semibold">
                        Complete Your Supabase Setup
                      </h2>
                      <p className="text-muted-foreground text-sm mt-2">
                        OAuth connected! Now please provide your Supabase Project URL and API Key to enable database access.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold">
                        Connect Your Supabase Project
                      </h2>
                      <p className="text-muted-foreground text-sm mt-2">
                        Connect your Supabase project to explore tables, run
                        queries, and manage data directly from this dashboard.
                      </p>
                    </>
                  )}
                </div>
                <SupabaseConnectForm />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
