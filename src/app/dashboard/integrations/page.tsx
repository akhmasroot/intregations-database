import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/integrations/auth-check";
import { IntegrationSidebar } from "@/components/integrations/integration-sidebar";
import { ConnectionStatusBadge } from "@/components/integrations/connection-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Database, Layers, Shield, Zap, Globe, ArrowRight } from "lucide-react";

interface IntegrationRecord {
  provider: string;
  connectedAt: Date;
  supabaseProjectRef: string | null;
  convexProjectId: string | null;
  tursoDatabaseName: string | null;
}

async function getIntegrationStatuses(userId: string) {
  const integrations = await db.userIntegration.findMany({
    where: { userId, isActive: true },
    select: { provider: true, connectedAt: true, supabaseProjectRef: true, convexProjectId: true, tursoDatabaseName: true },
  }) as IntegrationRecord[];

  const supabase = integrations.find((i) => i.provider === "supabase");
  const convex = integrations.find((i) => i.provider === "convex");
  const turso = integrations.find((i) => i.provider === "turso");

  return { supabase, convex, turso };
}

export default async function IntegrationsPage() {
  const userId = await getCurrentUserId();
  const { supabase, convex, turso } = userId
    ? await getIntegrationStatuses(userId)
    : { supabase: null, convex: null, turso: null };

  const providers = [
    {
      id: "supabase",
      name: "Supabase",
      description:
        "Open-source Firebase alternative with PostgreSQL database, real-time subscriptions, and built-in auth.",
      href: "/dashboard/integrations/supabase",
      icon: Database,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      isConnected: !!supabase,
      connectedAt: supabase?.connectedAt,
      features: ["PostgreSQL", "Real-time", "Row Level Security", "REST API"],
      badges: ["OAuth", "API Key"],
      accentColor: "border-emerald-500/20 hover:border-emerald-500/40",
    },
    {
      id: "convex",
      name: "Convex",
      description:
        "Full-stack TypeScript database platform with real-time sync, serverless functions, and automatic scaling.",
      href: "/dashboard/integrations/convex",
      icon: Layers,
      iconColor: "text-orange-400",
      iconBg: "bg-orange-500/10",
      isConnected: !!convex,
      connectedAt: convex?.connectedAt,
      features: ["TypeScript-native", "Real-time sync", "Serverless", "ACID transactions"],
      badges: ["OAuth"],
      accentColor: "border-orange-500/20 hover:border-orange-500/40",
    },
    {
      id: "turso",
      name: "Turso",
      description:
        "SQLite-compatible edge database built on libsql. Fast, lightweight, and perfect for edge deployments.",
      href: "/dashboard/integrations/turso",
      icon: Database,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/10",
      isConnected: !!turso,
      connectedAt: turso?.connectedAt,
      features: ["SQLite-compatible", "Edge-ready", "libsql protocol", "Low latency"],
      badges: ["API Token"],
      accentColor: "border-cyan-500/20 hover:border-cyan-500/40",
    },
  ];

  return (
    <div className="flex min-h-screen bg-background dark">
      <IntegrationSidebar
        supabaseConnected={!!supabase}
        convexConnected={!!convex}
        tursoConnected={!!turso}
      />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Database Integrations
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Connect your external databases to manage data, run queries, and
            perform CRUD operations directly from this dashboard. All credentials
            are encrypted and stored securely.
          </p>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 mb-8">
          <Shield className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-300">
              Security & Privacy
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All API keys and tokens are encrypted using AES-256-CBC before
              storage. Credentials are never exposed to the client-side. All
              database operations are proxied through our secure server-side API
              routes.
            </p>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => {
            const Icon = provider.icon;
            return (
              <Card
                key={provider.id}
                className={`border transition-colors ${provider.accentColor} bg-card`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-lg ${provider.iconBg}`}
                      >
                        <Icon
                          className={`h-6 w-6 ${provider.iconColor}`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {provider.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {provider.badges.map((badge) => (
                            <Badge
                              key={badge}
                              variant="outline"
                              className="text-xs py-0"
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <ConnectionStatusBadge
                      status={provider.isConnected ? "connected" : "disconnected"}
                    />
                  </div>
                  <CardDescription className="mt-3">
                    {provider.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {provider.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <Zap className="h-3 w-3" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {provider.isConnected && provider.connectedAt && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Connected{" "}
                      {new Date(provider.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>

                <CardFooter>
                  <Button asChild className="w-full" variant={provider.isConnected ? "outline" : "default"}>
                    <Link href={provider.href}>
                      {provider.isConnected ? (
                        <>
                          <Globe className="h-4 w-4 mr-2" />
                          Manage Database
                        </>
                      ) : (
                        <>
                          Connect {provider.name}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Connected Databases",
              value: [supabase, convex, turso].filter(Boolean).length,
              icon: Database,
            },
            {
              label: "Encryption",
              value: "AES-256",
              icon: Shield,
            },
            {
              label: "Supported Providers",
              value: "3",
              icon: Layers,
            },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card"
              >
                <StatIcon className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
