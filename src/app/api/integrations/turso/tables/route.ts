import { NextResponse } from "next/server";
import { createTursoClientFromIntegration, getTursoTables } from "@/lib/integrations/turso-client";
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
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    if (!checkRateLimit(userId, "turso")) {
      return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), {
        status: 429,
      });
    }

    const integration = await validateIntegrationAccess(userId, "turso");
    const client = createTursoClientFromIntegration(integration);

    const tables = await getTursoTables(client);
    client.close();

    await logIntegrationOperation({
      userId,
      provider: "turso",
      action: "query",
      status: "success",
      metadata: { action: "list_tables", count: tables.length },
    });

    return NextResponse.json(successResponse({ tables }));
  } catch (error) {
    console.error("Turso tables error:", error);
    return NextResponse.json(
      errorResponse(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Failed to fetch tables"
      ),
      { status: 500 }
    );
  }
}
