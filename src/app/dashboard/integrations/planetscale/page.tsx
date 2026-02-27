import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/integrations/auth-check";
import { IntegrationSidebar } from "@/components/integrations/integration-sidebar";
import { ConnectionStatusBadge } from "@/components/integrations/connection-status-badge";
import { PlanetScaleConnectForm } from "./_components/planetscale-connect-form";
import { PlanetScaleDatabaseExplorer } from "./_components/planetscale-database-explorer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Database, ExternalLink } from "lucide-react";

async function getPlanetScaleIntegration(userId: string) {
  return db.userIntegration.findUnique({
    where: {
      userId_provider: { userId, provider: "planetscale" },
    },
    select: {
      id: true,
      isActive: true,
      connectedAt: true,
      planetscaleDatabaseName: true,
    },
  });
}

export default async function PlanetScaleDashboardPage() {
  const userId = await getCurrentUserId();
  const integration = userId ? await getPlanetScaleIntegration(userId) : null;
  const isConnected = !!integration?.isActive;

  return (
    <div className="flex min-h-screen bg-background dark">
      <IntegrationSidebar planetscaleConnected={isConnected} />

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
              <div className="p-1.5 rounded-md bg-purple-500/10">
                <Database className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">PlanetScale</h1>
                {integration?.planetscaleDatabaseName && (
                  <p className="text-xs text-muted-foreground">{integration.planetscaleDatabaseName}</p>
                )}
              </div>
            </div>
            <ConnectionStatusBadge status={isConnected ? "connected" : "disconnected"} />
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.planetscale.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Open PlanetScale
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isConnected ? (
            <PlanetScaleDatabaseExplorer />
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="w-full max-w-lg">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 rounded-full bg-purple-500/10 mb-4">
                    <Database className="h-8 w-8 text-purple-400" />
                  </div>
                  <h2 className="text-xl font-semibold">Connect Your PlanetScale Database</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Connect your PlanetScale MySQL-compatible database to explore tables, run SQL queries, and manage data directly from this dashboard.
                  </p>
                </div>
                <PlanetScaleConnectForm />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
