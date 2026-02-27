import { NextResponse } from "next/server";
import { createSupabaseClientFromIntegration } from "@/lib/integrations/supabase-client";
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

    if (!checkRateLimit(userId, "supabase")) {
      return NextResponse.json(
        errorResponse("RATE_LIMITED", "Too many requests"),
        { status: 429 }
      );
    }

    const integration = await validateIntegrationAccess(userId, "supabase");
    const client = createSupabaseClientFromIntegration(integration);

    // Query tables from information_schema
    const { data, error } = await client
      .from("information_schema.tables")
      .select("table_name, table_type")
      .eq("table_schema", "public")
      .order("table_name");

    if (error) {
      // Try alternative approach using RPC
      const { data: rpcData, error: rpcError } = await client.rpc("exec_sql", {
        query: `
          SELECT 
            t.table_name as name,
            t.table_type as type,
            COALESCE(s.n_live_tup, 0) as row_count
          FROM information_schema.tables t
          LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
          WHERE t.table_schema = 'public'
          ORDER BY t.table_name
        `,
      });

      if (rpcError) {
        return NextResponse.json(
          errorResponse("QUERY_ERROR", "Failed to fetch tables: " + rpcError.message),
          { status: 500 }
        );
      }

      return NextResponse.json(
        successResponse({
          tables: (rpcData ?? []).map((t: Record<string, unknown>) => ({
            name: t.name,
            type: t.type === "BASE TABLE" ? "table" : "view",
            rowCount: Number(t.row_count) || 0,
          })),
        })
      );
    }

    // Get row counts for each table
    const tables = await Promise.all(
      (data ?? []).map(async (table) => {
        let rowCount = 0;
        try {
          const { count } = await client
            .from(table.table_name)
            .select("*", { count: "exact", head: true });
          rowCount = count ?? 0;
        } catch {
          // Ignore count errors
        }
        return {
          name: table.table_name,
          type: table.table_type === "BASE TABLE" ? "table" : "view",
          rowCount,
        };
      })
    );

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "query",
      status: "success",
      metadata: { action: "list_tables", count: tables.length },
    });

    return NextResponse.json(successResponse({ tables }));
  } catch (error) {
    console.error("Supabase tables error:", error);
    return NextResponse.json(
      errorResponse(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Failed to fetch tables"
      ),
      { status: 500 }
    );
  }
}
