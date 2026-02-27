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

    if (!checkRateLimit(userId, "turso")) {
      return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), {
        status: 429,
      });
    }

    const integration = await validateIntegrationAccess(userId, "turso");
    const client = createTursoClientFromIntegration(integration);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);
    const search = searchParams.get("search") ?? "";
    const sortBy = searchParams.get("sortBy") ?? "";
    const sortDir = searchParams.get("sortDir") ?? "asc";

    const offset = (page - 1) * limit;

    // Build query
    let sql = `SELECT * FROM "${tableName}"`;
    const args: (string | number)[] = [];

    if (search) {
      // Simple search - get column names first
      const pragmaResult = await client.execute(`PRAGMA table_info("${tableName}")`);
      const textColumns = pragmaResult.rows
        .filter((row) => {
          const type = String(row[2] ?? "").toUpperCase();
          return type === "TEXT" || type === "" || type.includes("CHAR") || type.includes("CLOB");
        })
        .map((row) => String(row[1] ?? ""));

      if (textColumns.length > 0) {
        const conditions = textColumns.map((col) => `"${col}" LIKE ?`).join(" OR ");
        sql += ` WHERE (${conditions})`;
        textColumns.forEach(() => args.push(`%${search}%`));
      }
    }

    if (sortBy) {
      sql += ` ORDER BY "${sortBy}" ${sortDir === "desc" ? "DESC" : "ASC"}`;
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as count FROM "${tableName}"`;
    if (search && args.length > 0) {
      const pragmaResult = await client.execute(`PRAGMA table_info("${tableName}")`);
      const textColumns = pragmaResult.rows
        .filter((row) => {
          const type = String(row[2] ?? "").toUpperCase();
          return type === "TEXT" || type === "" || type.includes("CHAR");
        })
        .map((row) => String(row[1] ?? ""));
      if (textColumns.length > 0) {
        const conditions = textColumns.map((col) => `"${col}" LIKE ?`).join(" OR ");
        countSql += ` WHERE (${conditions})`;
      }
    }

    const countResult = await client.execute({ sql: countSql, args: search ? args : [] });
    const totalCount = Number(countResult.rows[0]?.[0] ?? 0);

    // Get paginated data
    sql += ` LIMIT ? OFFSET ?`;
    args.push(limit, offset);

    const result = await client.execute({ sql, args });
    client.close();

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
      tableName,
      status: "success",
    });

    return NextResponse.json(
      successResponse({
        rows,
        totalCount,
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

    const integration = await validateIntegrationAccess(userId, "turso");
    const client = createTursoClientFromIntegration(integration);

    const body = await request.json();

    // Build INSERT statement
    const columns = Object.keys(body).filter((k) => k !== "id" && k !== "created_at");
    const values = columns.map((col) => body[col]);
    const placeholders = columns.map(() => "?").join(", ");
    const colNames = columns.map((c) => `"${c}"`).join(", ");

    const sql = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
    const result = await client.execute({ sql, args: values });
    client.close();

    await logIntegrationOperation({
      userId,
      provider: "turso",
      action: "insert",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ rowsAffected: result.rowsAffected, lastInsertRowid: result.lastInsertRowid }));
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

    const integration = await validateIntegrationAccess(userId, "turso");
    const client = createTursoClientFromIntegration(integration);

    const body = await request.json();
    const { id, ...updateData } = body;

    if (id === undefined || id === null) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Row ID is required for update"),
        { status: 400 }
      );
    }

    // Build UPDATE statement
    const columns = Object.keys(updateData).filter((k) => k !== "created_at");
    const setClauses = columns.map((col) => `"${col}" = ?`).join(", ");
    const values = [...columns.map((col) => updateData[col]), id];

    const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE id = ?`;
    await client.execute({ sql, args: values });
    client.close();

    await logIntegrationOperation({
      userId,
      provider: "turso",
      action: "update",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ message: "Row updated" }));
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

    const integration = await validateIntegrationAccess(userId, "turso");
    const client = createTursoClientFromIntegration(integration);

    const body = await request.json();
    const { id } = body;

    if (id === undefined || id === null) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Row ID is required for delete"),
        { status: 400 }
      );
    }

    await client.execute({ sql: `DELETE FROM "${tableName}" WHERE id = ?`, args: [id] });
    client.close();

    await logIntegrationOperation({
      userId,
      provider: "turso",
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
