import { NextRequest, NextResponse } from "next/server";
import { createTursoClientFromIntegration } from "@/lib/integrations/turso-client";
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

    const body = await request.json();
    const { query } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Query is required"),
        { status: 400 }
      );
    }

    const startTime = Date.now();

    const result = await client.execute(query);
    client.close();

    const executionTime = Date.now() - startTime;

    // Convert rows to objects
    const columns = result.columns;
    const rows = result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    await logIntegrationOperation({
      userId,
      provider: "turso",
      action: "query",
      status: "success",
      metadata: { executionTime, rowCount: rows.length },
    });

    return NextResponse.json(
      successResponse({
        rows,
        rowCount: rows.length,
        executionTime,
        rowsAffected: result.rowsAffected,
      })
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("QUERY_ERROR", error instanceof Error ? error.message : "Query failed"),
      { status: 400 }
    );
  }
}
