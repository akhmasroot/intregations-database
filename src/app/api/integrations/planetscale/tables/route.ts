import { NextResponse } from "next/server";
import { createPlanetScaleClientFromIntegration, getPlanetScaleTables } from "@/lib/integrations/planetscale-client";
import {
  getCurrentUserId,
  validateIntegrationAccess,
  logIntegrationOperation,
  checkRateLimit,
  successResponse,
  errorResponse,
} from "@/lib/integrations/auth-check";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    }

    if (!checkRateLimit(userId, "planetscale")) {
      return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), { status: 429 });
    }

    const integration = await validateIntegrationAccess(userId, "planetscale");
    const conn = createPlanetScaleClientFromIntegration(integration);
    const tables = await getPlanetScaleTables(conn);

    await logIntegrationOperation({ userId, provider: "planetscale", action: "query", status: "success", metadata: { action: "list_tables", count: tables.length } });

    return NextResponse.json(successResponse({ tables }));
  } catch (error) {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch tables"), { status: 500 });
  }
}
