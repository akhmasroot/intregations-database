import { NextResponse } from "next/server";
import { decrypt } from "@/lib/integrations/encryption";
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

    if (!integration.supabaseUrl || !integration.supabaseAnonKey) {
      return NextResponse.json(
        errorResponse("CONFIGURATION_ERROR", "Supabase credentials not configured"),
        { status: 400 }
      );
    }

    const url = decrypt(integration.supabaseUrl);
    const key = integration.supabaseServiceKey
      ? decrypt(integration.supabaseServiceKey)
      : decrypt(integration.supabaseAnonKey);

    // Use Supabase REST API to get tables via pg_catalog
    // This works with both anon key and service key
    const response = await fetch(
      `${url}/rest/v1/rpc/get_tables`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      // Fallback: use the Supabase Management API approach
      // Try to get tables via a direct SQL query using the REST API
      const sqlResponse = await fetch(
        `${url}/rest/v1/`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
        }
      );

      if (!sqlResponse.ok) {
        return NextResponse.json(
          errorResponse("QUERY_ERROR", "Failed to fetch tables"),
          { status: 500 }
        );
      }

      // Parse the OpenAPI spec to get table names
      const spec = await sqlResponse.json();
      const paths = spec?.paths ?? {};
      const tables = Object.keys(paths)
        .filter((path) => path.startsWith("/") && !path.includes("{"))
        .map((path) => ({
          name: path.slice(1), // Remove leading /
          type: "table",
          rowCount: 0,
        }))
        .filter((t) => t.name && !t.name.startsWith("rpc/"));

      await logIntegrationOperation({
        userId,
        provider: "supabase",
        action: "query",
        status: "success",
        metadata: { action: "list_tables", count: tables.length },
      });

      return NextResponse.json(successResponse({ tables }));
    }

    const data = await response.json();
    const tables = (Array.isArray(data) ? data : []).map((t: Record<string, unknown>) => ({
      name: String(t.table_name ?? t.name ?? ""),
      type: String(t.table_type ?? "table") === "BASE TABLE" ? "table" : "view",
      rowCount: Number(t.row_count ?? 0),
    }));

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
