import { NextRequest, NextResponse } from "next/server";
import { createPlanetScaleClientFromIntegration } from "@/lib/integrations/planetscale-client";
import {
  getCurrentUserId,
  validateIntegrationAccess,
  logIntegrationOperation,
  checkRateLimit,
  successResponse,
  errorResponse,
} from "@/lib/integrations/auth-check";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    if (!checkRateLimit(userId, "planetscale")) return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), { status: 429 });

    const integration = await validateIntegrationAccess(userId, "planetscale");
    const conn = createPlanetScaleClientFromIntegration(integration);

    const body = await request.json();
    const { query } = body;

    if (!query?.trim()) return NextResponse.json(errorResponse("INVALID_REQUEST", "Query is required"), { status: 400 });

    const startTime = Date.now();
    const result = await conn.execute(query);
    const executionTime = Date.now() - startTime;

    const rows = result.rows as Record<string, unknown>[];

    await logIntegrationOperation({ userId, provider: "planetscale", action: "query", status: "success", metadata: { executionTime, rowCount: rows.length } });

    return NextResponse.json(successResponse({
      rows,
      rowCount: rows.length,
      executionTime,
      rowsAffected: result.rowsAffected,
    }));
  } catch (error) {
    return NextResponse.json(errorResponse("QUERY_ERROR", error instanceof Error ? error.message : "Query failed"), { status: 400 });
  }
}
