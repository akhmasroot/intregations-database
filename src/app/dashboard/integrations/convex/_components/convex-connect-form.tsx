"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExternalLink, Layers, Shield } from "lucide-react";

interface ConvexConnectFormProps {
  onConnected?: () => void;
}

export function ConvexConnectForm({ onConnected: _ }: ConvexConnectFormProps) {
  const handleOAuthConnect = () => {
    window.location.href = "/api/integrations/convex/oauth/authorize";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-orange-500/10">
            <Layers className="h-4 w-4 text-orange-400" />
          </div>
          Connect with Convex OAuth
        </CardTitle>
        <CardDescription>
          Authorize this app to access your Convex projects securely using
          OAuth 2.0.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Requirements */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-sm text-blue-300 font-medium mb-2">
            Requirements
          </p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• You need a Convex OAuth App configured</li>
            <li>
              • Register at:{" "}
              <a
                href="https://dashboard.convex.dev/team/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                dashboard.convex.dev/team/settings
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              • Set{" "}
              <code className="font-mono bg-muted px-1 rounded">
                CONVEX_CLIENT_ID
              </code>{" "}
              and{" "}
              <code className="font-mono bg-muted px-1 rounded">
                CONVEX_CLIENT_SECRET
              </code>{" "}
              in your environment
            </li>
            <li>
              • Set redirect URI to:{" "}
              <code className="font-mono bg-muted px-1 rounded text-xs">
                {typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}
                /api/integrations/convex/oauth/callback
              </code>
            </li>
          </ul>
        </div>

        {/* Security info */}
        <div className="flex items-start gap-2 p-3 rounded-md border border-green-500/20 bg-green-500/5">
          <Shield className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
          <p className="text-xs text-green-300">
            OAuth is the most secure way to connect. Your Convex credentials
            are never stored directly — only the OAuth access token is saved
            (encrypted).
          </p>
        </div>

        <Button
          onClick={handleOAuthConnect}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          size="lg"
        >
          <Layers className="h-4 w-4 mr-2" />
          Connect with Convex
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          You&apos;ll be redirected to Convex to authorize access to your
          projects.
        </p>
      </CardContent>
    </Card>
  );
}
