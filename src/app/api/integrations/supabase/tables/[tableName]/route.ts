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

interface RouteParams {
  params: Promise<{ tableName: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);
    const search = searchParams.get("search") ?? "";
    const sortBy = searchParams.get("sortBy") ?? "";
    const sortDir = searchParams.get("sortDir") ?? "asc";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = client.from(tableName).select("*", { count: "exact" });

    // Apply search (basic text search on all columns)
    if (search) {
      // This is a simplified search - in production you'd want full-text search
      query = query.or(
        `id.ilike.%${search}%`
      );
    }

    // Apply sorting
    if (sortBy) {
      query = query.order(sortBy, { ascending: sortDir === "asc" });
    }

    // Apply pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        errorResponse("QUERY_ERROR", error.message),
        { status: 400 }
      );
    }

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "query",
      tableName,
      status: "success",
    });

    return NextResponse.json(
      successResponse({
        rows: data ?? [],
        totalCount: count ?? 0,
        page,
        limit,
      })
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch data"),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    const integration = await validateIntegrationAccess(userId, "supabase");
    const client = createSupabaseClientFromIntegration(integration, !!integration.supabaseServiceKey);

    const body = await request.json();

    const { data, error } = await client.from(tableName).insert(body).select();

    if (error) {
      // Provide helpful message for RLS violations
      const message = error.message.includes("row-level security")
        ? `Row Level Security (RLS) is blocking this operation. To bypass RLS, add your Service Role Key in the connection settings. Error: ${error.message}`
        : error.message;
      return NextResponse.json(
        errorResponse("QUERY_ERROR", message),
        { status: 400 }
      );
    }

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "insert",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ row: data?.[0] }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Insert failed"),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    const integration = await validateIntegrationAccess(userId, "supabase");
    const client = createSupabaseClientFromIntegration(integration, !!integration.supabaseServiceKey);

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Row ID is required for update"),
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from(tableName)
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      const message = error.message.includes("row-level security")
        ? `Row Level Security (RLS) is blocking this operation. Add your Service Role Key to bypass RLS. Error: ${error.message}`
        : error.message;
      return NextResponse.json(
        errorResponse("QUERY_ERROR", message),
        { status: 400 }
      );
    }

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "update",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ row: data?.[0] }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Update failed"),
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    const integration = await validateIntegrationAccess(userId, "supabase");
    const client = createSupabaseClientFromIntegration(integration, !!integration.supabaseServiceKey);

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Row ID is required for delete"),
        { status: 400 }
      );
    }

    const { error } = await client.from(tableName).delete().eq("id", id);

    if (error) {
      const message = error.message.includes("row-level security")
        ? `Row Level Security (RLS) is blocking this operation. Add your Service Role Key to bypass RLS. Error: ${error.message}`
        : error.message;
      return NextResponse.json(
        errorResponse("QUERY_ERROR", message),
        { status: 400 }
      );
    }

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "delete",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ message: "Row deleted" }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Delete failed"),
      { status: 500 }
    );
  }
}
