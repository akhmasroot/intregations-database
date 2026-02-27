import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

    const url = decrypt(integration.supabaseUrl);
    const key = hasServiceKey
      ? decrypt(integration.supabaseServiceKey!)
      : decrypt(integration.supabaseAnonKey);

    // Security: restrict to SELECT queries if no service key
    const trimmedQuery = query.trim().toUpperCase();
    const isWriteQuery = !trimmedQuery.startsWith("SELECT") &&
      !trimmedQuery.startsWith("WITH") &&
      !trimmedQuery.startsWith("EXPLAIN");

    if (isWriteQuery && !hasServiceKey) {
      return NextResponse.json(
        errorResponse(
          "UNAUTHORIZED",
          "DDL queries (CREATE TABLE, ALTER, DROP, etc.) require a Service Role Key. Add your Service Role Key in the connection settings to enable this feature."
        ),
        { status: 403 }
      );
    }

    const startTime = Date.now();

    // Use Supabase client with service key for write operations
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // For SELECT queries, try to use PostgREST
    if (!isWriteQuery) {
      // Try to extract table name and use PostgREST
      const tableMatch = query.match(/FROM\s+"?(\w+)"?/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        const { data, error } = await client.from(tableName).select("*").limit(100);
        const executionTime = Date.now() - startTime;

        if (!error) {
          await logIntegrationOperation({
            userId,
            provider: "supabase",
            action: "query",
            status: "success",
            metadata: { executionTime, rowCount: data?.length ?? 0 },
          });
          return NextResponse.json(
            successResponse({
              data: data ?? [],
              rowCount: data?.length ?? 0,
              executionTime,
            })
          );
        }
      }
    }

    // For DDL/DML with service key, use the Supabase pg endpoint
    // This endpoint is available on Supabase projects and accepts service key
    const pgEndpoints = [
      `${url}/pg/query`,
      `${url}/rest/v1/rpc/exec_sql`,
    ];

    for (const endpoint of pgEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (response.ok) {
          const data = await response.json();
          const executionTime = Date.now() - startTime;

          await logIntegrationOperation({
            userId,
            provider: "supabase",
            action: "query",
            status: "success",
            metadata: { executionTime },
          });

          return NextResponse.json(
            successResponse({
              data: Array.isArray(data) ? data : [{ result: "Query executed successfully" }],
              rowCount: Array.isArray(data) ? data.length : 1,
              executionTime,
            })
          );
        }
      } catch {
        // Try next endpoint
      }
    }

    // If all endpoints fail, return a helpful error
    const executionTime = Date.now() - startTime;
    void executionTime;

    return NextResponse.json(
      errorResponse(
        "QUERY_ERROR",
        isWriteQuery
          ? "DDL query execution failed. Supabase requires the Management API for DDL operations. Please ensure your Service Role Key has the necessary permissions, or use the Supabase SQL Editor directly at supabase.com/dashboard."
          : "Query execution failed. Please check your query syntax."
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
