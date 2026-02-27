import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClientFromIntegration } from "@/lib/integrations/supabase-client";
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

    if (!checkRateLimit(userId, "supabase")) {
      return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), {
        status: 429,
      });
    }

    const integration = await validateIntegrationAccess(userId, "supabase");
    const hasServiceKey = !!integration.supabaseServiceKey;
    const client = createSupabaseClientFromIntegration(integration, hasServiceKey);

    const body = await request.json();
    const { query } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Query is required"),
        { status: 400 }
      );
    }

    // Security: restrict to SELECT queries if no service key
    const trimmedQuery = query.trim().toUpperCase();
    if (
      !hasServiceKey &&
      !trimmedQuery.startsWith("SELECT") &&
      !trimmedQuery.startsWith("WITH") &&
      !trimmedQuery.startsWith("EXPLAIN")
    ) {
      return NextResponse.json(
        errorResponse(
          "UNAUTHORIZED",
          "Only SELECT queries are allowed without a Service Role Key"
        ),
        { status: 403 }
      );
    }

    const startTime = Date.now();

    // Execute via RPC
    const { data, error } = await client.rpc("exec_sql", { query });

    const executionTime = Date.now() - startTime;

    if (error) {
      await logIntegrationOperation({
        userId,
        provider: "supabase",
        action: "query",
        status: "error",
        errorMessage: error.message,
        metadata: { query: query.slice(0, 200) },
      });

      return NextResponse.json(
        errorResponse("QUERY_ERROR", error.message),
        { status: 400 }
      );
    }

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "query",
      status: "success",
      metadata: { executionTime, rowCount: Array.isArray(data) ? data.length : 0 },
    });

    return NextResponse.json(
      successResponse({
        data: Array.isArray(data) ? data : [data],
        rowCount: Array.isArray(data) ? data.length : 1,
        executionTime,
      })
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Query failed"),
      { status: 500 }
    );
  }
}
