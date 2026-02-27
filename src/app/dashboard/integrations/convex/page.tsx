import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/integrations/auth-check";
import { IntegrationSidebar } from "@/components/integrations/integration-sidebar";
import { ConnectionStatusBadge } from "@/components/integrations/connection-status-badge";
import { ConvexConnectForm } from "./_components/convex-connect-form";
import { ProjectExplorer } from "./_components/project-explorer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Layers, ExternalLink } from "lucide-react";

async function getConvexIntegration(userId: string) {
  return db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "convex",
      },
    },
    select: {
      id: true,
      isActive: true,
      connectedAt: true,
      convexProjectId: true,
      convexDeploymentUrl: true,
    },
  });
}

export default async function ConvexDashboardPage() {
  const userId = await getCurrentUserId();
  const integration = userId ? await getConvexIntegration(userId) : null;
  const isConnected = !!integration?.isActive;

  return (
    <div className="flex min-h-screen bg-background dark">
      <IntegrationSidebar convexConnected={isConnected} />

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
              <div className="p-1.5 rounded-md bg-orange-500/10">
                <Layers className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Convex</h1>
                {integration?.convexDeploymentUrl && (
                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                    {integration.convexDeploymentUrl}
                  </p>
                )}
              </div>
            </div>
            <ConnectionStatusBadge
              status={isConnected ? "connected" : "disconnected"}
            />
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://dashboard.convex.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open Convex
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isConnected ? (
            <ProjectExplorer />
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="w-full max-w-lg">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 rounded-full bg-orange-500/10 mb-4">
                    <Layers className="h-8 w-8 text-orange-400" />
                  </div>
                  <h2 className="text-xl font-semibold">
                    Connect Your Convex Project
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    Connect your Convex project to explore collections, manage
                    documents, and view your data directly from this dashboard.
                  </p>
                </div>
                <ConvexConnectForm />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
