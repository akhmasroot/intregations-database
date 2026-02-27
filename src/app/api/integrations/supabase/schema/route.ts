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
    const client = createSupabaseClientFromIntegration(integration);

    const tableName = request.nextUrl.searchParams.get("table");
    if (!tableName) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Table name is required"),
        { status: 400 }
      );
    }

    // Get column information
    const { data, error } = await client
      .from("information_schema.columns")
      .select(
        "column_name, data_type, is_nullable, column_default, ordinal_position"
      )
      .eq("table_schema", "public")
      .eq("table_name", tableName)
      .order("ordinal_position");

    if (error) {
      return NextResponse.json(
        errorResponse("QUERY_ERROR", error.message),
        { status: 400 }
      );
    }

    // Primary key detection - simplified (id column is typically PK)
    const primaryKeys = new Set<string>(["id"]);

    const columns = (data ?? []).map((col) => ({
      column_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
      column_default: col.column_default,
      is_primary_key: primaryKeys.has(col.column_name),
    }));

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
    
    // Creating tables requires service key
    const client = createSupabaseClientFromIntegration(integration, !!integration.supabaseServiceKey);

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
      "id uuid PRIMARY KEY DEFAULT uuid_generate_v4()",
      "created_at timestamptz DEFAULT now()",
      ...columns.map((col: {
        name: string;
        type: string;
        nullable?: boolean;
        defaultValue?: string;
        isUnique?: boolean;
      }) => {
        const parts = [`${col.name} ${col.type}`];
        if (!col.nullable) parts.push("NOT NULL");
        if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
        if (col.isUnique) parts.push("UNIQUE");
        return parts.join(" ");
      }),
    ];

    const sql = `CREATE TABLE ${tableName} (\n  ${columnDefs.join(",\n  ")}\n);`;

    // Execute via RPC
    const { error } = await client.rpc("exec_sql", { query: sql });

    if (error) {
      return NextResponse.json(
        errorResponse("QUERY_ERROR", error.message),
        { status: 400 }
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
      successResponse({ message: `Table "${tableName}" created successfully` })
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to create table"),
      { status: 500 }
    );
  }
}
