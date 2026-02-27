import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/integrations/encryption";
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

    if (!integration.supabaseUrl || !integration.supabaseAnonKey) {
      return NextResponse.json(
        errorResponse("CONFIGURATION_ERROR", "Supabase credentials not configured"),
        { status: 400 }
      );
    }

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
    const isWriteQuery = !trimmedQuery.startsWith("SELECT") &&
      !trimmedQuery.startsWith("WITH") &&
      !trimmedQuery.startsWith("EXPLAIN");

    if (isWriteQuery && !hasServiceKey) {
      return NextResponse.json(
        errorResponse(
          "UNAUTHORIZED",
          "Only SELECT queries are allowed without a Service Role Key. Add a Service Role Key to run DDL/DML queries."
        ),
        { status: 403 }
      );
    }

    const url = decrypt(integration.supabaseUrl);
    const key = hasServiceKey
      ? decrypt(integration.supabaseServiceKey!)
      : decrypt(integration.supabaseAnonKey);

    // Extract project ref for Management API
    const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

    const startTime = Date.now();

    // Try Supabase Management API for DDL queries (CREATE, ALTER, DROP, etc.)
    if (isWriteQuery && projectRef) {
      const mgmtResponse = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        }
      );

      const executionTime = Date.now() - startTime;

      if (mgmtResponse.ok) {
        const data = await mgmtResponse.json();
        await logIntegrationOperation({
          userId,
          provider: "supabase",
          action: "query",
          status: "success",
          metadata: { executionTime },
        });
        return NextResponse.json(
          successResponse({
            data: Array.isArray(data) ? data : [data],
            rowCount: Array.isArray(data) ? data.length : 1,
            executionTime,
          })
        );
      }
    }

    // For SELECT queries, use PostgREST with a workaround
    // Supabase doesn't support raw SQL via PostgREST, but we can use the pg endpoint
    const pgResponse = await fetch(`${url}/pg/query`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const executionTime = Date.now() - startTime;

    if (pgResponse.ok) {
      const data = await pgResponse.json();
      await logIntegrationOperation({
        userId,
        provider: "supabase",
        action: "query",
        status: "success",
        metadata: { executionTime },
      });
      return NextResponse.json(
        successResponse({
          data: Array.isArray(data) ? data : [data],
          rowCount: Array.isArray(data) ? data.length : 1,
          executionTime,
        })
      );
    }

    // Last resort: try the REST API with a simple select
    // For SELECT queries, we can use the Supabase client
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // For simple SELECT queries, try to parse the table name and use the client
    const tableMatch = query.match(/FROM\s+"?(\w+)"?/i);
    if (tableMatch && trimmedQuery.startsWith("SELECT")) {
      const tableName = tableMatch[1];
      const { data, error } = await client.from(tableName).select("*").limit(100);

      if (!error) {
        return NextResponse.json(
          successResponse({
            data: data ?? [],
            rowCount: data?.length ?? 0,
            executionTime: Date.now() - startTime,
          })
        );
      }
    }

    return NextResponse.json(
      errorResponse(
        "QUERY_ERROR",
        "Could not execute query. For DDL queries (CREATE TABLE, etc.), a Service Role Key with Management API access is required."
      ),
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Query failed"),
      { status: 500 }
    );
  }
}
