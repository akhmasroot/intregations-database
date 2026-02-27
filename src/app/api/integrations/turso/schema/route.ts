import { NextRequest, NextResponse } from "next/server";
import {
  createTursoClientFromIntegration,
  getTursoTableSchema,
  buildCreateTableSQL,
} from "@/lib/integrations/turso-client";
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

    if (!checkRateLimit(userId, "turso")) {
      return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), {
        status: 429,
      });
    }

    const integration = await validateIntegrationAccess(userId, "turso");
    const client = createTursoClientFromIntegration(integration);

    const tableName = request.nextUrl.searchParams.get("table");
    if (!tableName) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Table name is required"),
        { status: 400 }
      );
    }

    const columns = await getTursoTableSchema(client, tableName);
    client.close();

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

    const integration = await validateIntegrationAccess(userId, "turso");
    const client = createTursoClientFromIntegration(integration);

    const body = await request.json();
    const { tableName, columns } = body;

    if (!tableName || !columns?.length) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Table name and columns are required"),
        { status: 400 }
      );
    }

    const sql = buildCreateTableSQL(tableName, columns);

    await client.execute(sql);
    client.close();

    await logIntegrationOperation({
      userId,
      provider: "turso",
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
