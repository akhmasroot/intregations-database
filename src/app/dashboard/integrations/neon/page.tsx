import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/integrations/auth-check";
import { IntegrationSidebar } from "@/components/integrations/integration-sidebar";
import { ConnectionStatusBadge } from "@/components/integrations/connection-status-badge";
import { NeonConnectForm } from "./_components/neon-connect-form";
import { NeonDatabaseExplorer } from "./_components/neon-database-explorer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Database, ExternalLink } from "lucide-react";

async function getNeonIntegration(userId: string) {
  return db.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "neon" } },
    select: { id: true, isActive: true, connectedAt: true, neonDatabaseName: true },
  });
}

export default async function NeonDashboardPage() {
  const userId = await getCurrentUserId();
  const integration = userId ? await getNeonIntegration(userId) : null;
  const isConnected = !!integration?.isActive;

  return (
    <div className="flex min-h-screen bg-background dark">
      <IntegrationSidebar neonConnected={isConnected} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href="/dashboard/integrations"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-green-500/10">
                <Database className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Neon</h1>
                {integration?.neonDatabaseName && <p className="text-xs text-muted-foreground">{integration.neonDatabaseName}</p>}
              </div>
            </div>
            <ConnectionStatusBadge status={isConnected ? "connected" : "disconnected"} />
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Button variant="outline" size="sm" asChild>
                <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Open Neon
                </a>
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {isConnected ? (
            <NeonDatabaseExplorer />
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="w-full max-w-lg">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 rounded-full bg-green-500/10 mb-4">
                    <Database className="h-8 w-8 text-green-400" />
                  </div>
                  <h2 className="text-xl font-semibold">Connect Your Neon Database</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Connect your Neon serverless PostgreSQL database to explore tables, run SQL queries, and manage data directly from this dashboard.
                  </p>
                </div>
                <NeonConnectForm />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
