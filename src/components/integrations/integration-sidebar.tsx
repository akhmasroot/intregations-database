"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Database, Layers, Settings, Home } from "lucide-react";

const navItems = [
  {
    label: "Overview",
    href: "/dashboard/integrations",
    icon: Home,
    exact: true,
  },
  {
    label: "Supabase",
    href: "/dashboard/integrations/supabase",
    icon: Database,
    description: "PostgreSQL database",
  },
  {
    label: "Convex",
    href: "/dashboard/integrations/convex",
    icon: Layers,
    description: "Real-time database",
  },
];

interface IntegrationSidebarProps {
  supabaseConnected?: boolean;
  convexConnected?: boolean;
}

export function IntegrationSidebar({
  supabaseConnected = false,
  convexConnected = false,
}: IntegrationSidebarProps) {
  const pathname = usePathname();

  const connectionStatus: Record<string, boolean> = {
    "/dashboard/integrations/supabase": supabaseConnected,
    "/dashboard/integrations/convex": convexConnected,
  };

  return (
    <aside className="w-64 min-h-screen border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-sm">Integrations</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const isConnected = connectionStatus[item.href];
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.label}</span>
                  {item.href !== "/dashboard/integrations" && (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        isConnected ? "bg-green-500" : "bg-muted-foreground/30"
                      )}
                    />
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Connect your databases to manage data directly from this dashboard.
        </p>
      </div>
    </aside>
  );
}
