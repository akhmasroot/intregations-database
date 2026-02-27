import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/integrations/encryption";
import { createSupabaseClientFromIntegration } from "@/lib/integrations/supabase-client";
import {
  getCurrentUserId,
  validateIntegrationAccess,
  logIntegrationOperation,
  checkRateLimit,
  successResponse,
  errorResponse,
} from "@/lib/integrations/auth-check";

export async function GET(request: NextRequest) {
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

    const tableName = request.nextUrl.searchParams.get("table");
    if (!tableName) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Table name is required"),
        { status: 400 }
      );
    }

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

    // Get schema from Supabase REST API OpenAPI spec
    const specResponse = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (specResponse.ok) {
      const spec = await specResponse.json();
      const tableSpec = spec?.definitions?.[tableName];

      if (tableSpec?.properties) {
        const columns = Object.entries(tableSpec.properties).map(([colName, colSpec]) => {
          const spec = colSpec as Record<string, unknown>;
          return {
            column_name: colName,
            data_type: String(spec.type ?? spec.format ?? "text"),
            is_nullable: "YES",
            column_default: null,
            is_primary_key: colName === "id",
          };
        });

        return NextResponse.json(successResponse({ columns }));
      }
    }

    // Fallback: try to get schema by selecting 0 rows and examining the response
    // Use the Supabase client to get a row and infer schema
    const client = createSupabaseClientFromIntegration(integration);
    const { data, error } = await client
      .from(tableName)
      .select("*")
      .limit(1);

    if (error) {
      return NextResponse.json(
        errorResponse("QUERY_ERROR", error.message),
        { status: 400 }
      );
    }

    // Infer columns from the first row or return empty
    let columns: Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      is_primary_key: boolean;
    }> = [];

    if (data && data.length > 0) {
      columns = Object.entries(data[0]).map(([key, value]) => ({
        column_name: key,
        data_type: value === null ? "text" : typeof value === "number" ? "integer" : typeof value === "boolean" ? "boolean" : "text",
        is_nullable: "YES",
        column_default: null,
        is_primary_key: key === "id",
      }));
    }

    return NextResponse.json(successResponse({ columns }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch schema"),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    const integration = await validateIntegrationAccess(userId, "supabase");

    if (!integration.supabaseUrl) {
      return NextResponse.json(
        errorResponse("CONFIGURATION_ERROR", "Supabase credentials not configured"),
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tableName, columns } = body;

    if (!tableName || !columns?.length) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Table name and columns are required"),
        { status: 400 }
      );
    }

    // Build CREATE TABLE SQL
    const columnDefs = [
      "id uuid PRIMARY KEY DEFAULT gen_random_uuid()",
      "created_at timestamptz DEFAULT now()",
      ...columns.map((col: {
        name: string;
        type: string;
        nullable?: boolean;
        defaultValue?: string;
        isUnique?: boolean;
      }) => {
        const parts = [`"${col.name}" ${col.type}`];
        if (!col.nullable) parts.push("NOT NULL");
        if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
        if (col.isUnique) parts.push("UNIQUE");
        return parts.join(" ");
      }),
    ];

    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(",\n  ")}\n);`;

    // Extract project ref from URL to use Management API
    const url = decrypt(integration.supabaseUrl);
    const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

    if (!projectRef) {
      return NextResponse.json(
        errorResponse("CONFIGURATION_ERROR", "Could not extract project reference from URL"),
        { status: 400 }
      );
    }

    // Use Supabase Management API to run SQL
    // This requires a service key or management API token
    const serviceKey = integration.supabaseServiceKey
      ? decrypt(integration.supabaseServiceKey)
      : integration.supabaseAnonKey
        ? decrypt(integration.supabaseAnonKey)
        : null;

    if (!serviceKey) {
      return NextResponse.json(
        errorResponse("CONFIGURATION_ERROR", "API key not configured"),
        { status: 400 }
      );
    }

    // Try Supabase Management API
    const mgmtResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!mgmtResponse.ok) {
      const errData = await mgmtResponse.json().catch(() => ({ message: "Unknown error" }));
      
      // If Management API fails, return the SQL for manual execution
      return NextResponse.json(
        successResponse({
          message: `Table creation via API failed. Please run this SQL manually in your Supabase SQL Editor:`,
          sql,
          manualRequired: true,
          error: errData?.message ?? "Management API not accessible with current credentials",
        })
      );
    }

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "create_table",
      tableName,
      status: "success",
    });

    return NextResponse.json(
      successResponse({ message: `Table "${tableName}" created successfully`, sql })
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to create table"),
      { status: 500 }
    );
  }
}
