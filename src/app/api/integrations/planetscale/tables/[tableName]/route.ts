import { NextRequest, NextResponse } from "next/server";
import { createPlanetScaleClientFromIntegration } from "@/lib/integrations/planetscale-client";
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
    if (!userId) return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    if (!checkRateLimit(userId, "planetscale")) return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), { status: 429 });

    const integration = await validateIntegrationAccess(userId, "planetscale");
    const conn = createPlanetScaleClientFromIntegration(integration);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);
    const search = searchParams.get("search") ?? "";
    const sortBy = searchParams.get("sortBy") ?? "";
    const sortDir = searchParams.get("sortDir") ?? "asc";
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await conn.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    const totalCount = Number((countResult.rows[0] as Record<string, unknown>)?.count ?? 0);

    // Build query
    let sql = `SELECT * FROM \`${tableName}\``;
    const args: (string | number)[] = [];

    if (search) {
      // Get text columns for search
      const colResult = await conn.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND DATA_TYPE IN ('varchar', 'text', 'char', 'longtext', 'mediumtext', 'tinytext')`,
        [tableName]
      );
      const textCols = colResult.rows.map((r) => String((r as Record<string, unknown>).COLUMN_NAME ?? "")).filter(Boolean);
      if (textCols.length > 0) {
        const conditions = textCols.map((col) => `\`${col}\` LIKE ?`).join(" OR ");
        sql += ` WHERE (${conditions})`;
        textCols.forEach(() => args.push(`%${search}%`));
      }
    }

    if (sortBy) sql += ` ORDER BY \`${sortBy}\` ${sortDir === "desc" ? "DESC" : "ASC"}`;
    sql += ` LIMIT ? OFFSET ?`;
    args.push(limit, offset);

    const result = await conn.execute(sql, args);
    const rows = result.rows as Record<string, unknown>[];

    await logIntegrationOperation({ userId, provider: "planetscale", action: "query", tableName, status: "success" });
    return NextResponse.json(successResponse({ rows, totalCount, page, limit }));
  } catch (error) {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch data"), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });

    const integration = await validateIntegrationAccess(userId, "planetscale");
    const conn = createPlanetScaleClientFromIntegration(integration);
    const body = await request.json();

    const columns = Object.keys(body).filter((k) => k !== "id" && k !== "created_at");
    const values = columns.map((col) => body[col]);
    const placeholders = columns.map(() => "?").join(", ");
    const colNames = columns.map((c) => `\`${c}\``).join(", ");

    const result = await conn.execute(`INSERT INTO \`${tableName}\` (${colNames}) VALUES (${placeholders})`, values);
    await logIntegrationOperation({ userId, provider: "planetscale", action: "insert", tableName, status: "success" });
    return NextResponse.json(successResponse({ insertId: result.insertId }));
  } catch (error) {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Insert failed"), { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });

    const integration = await validateIntegrationAccess(userId, "planetscale");
    const conn = createPlanetScaleClientFromIntegration(integration);
    const body = await request.json();
    const { id, ...updateData } = body;

    if (id === undefined || id === null) {
      return NextResponse.json(errorResponse("INVALID_REQUEST", "Row ID is required"), { status: 400 });
    }

    const columns = Object.keys(updateData).filter((k) => k !== "created_at");
    const setClauses = columns.map((col) => `\`${col}\` = ?`).join(", ");
    const values = [...columns.map((col) => updateData[col]), id];

    await conn.execute(`UPDATE \`${tableName}\` SET ${setClauses} WHERE id = ?`, values);
    await logIntegrationOperation({ userId, provider: "planetscale", action: "update", tableName, status: "success" });
    return NextResponse.json(successResponse({ message: "Row updated" }));
  } catch (error) {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Update failed"), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });

    const integration = await validateIntegrationAccess(userId, "planetscale");
    const conn = createPlanetScaleClientFromIntegration(integration);
    const body = await request.json();
    const { id } = body;

    if (id === undefined || id === null) {
      return NextResponse.json(errorResponse("INVALID_REQUEST", "Row ID is required"), { status: 400 });
    }

    await conn.execute(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id]);
    await logIntegrationOperation({ userId, provider: "planetscale", action: "delete", tableName, status: "success" });
    return NextResponse.json(successResponse({ message: "Row deleted" }));
  } catch (error) {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Delete failed"), { status: 500 });
  }
}
