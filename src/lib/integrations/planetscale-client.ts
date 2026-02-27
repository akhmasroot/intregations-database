import { connect, type Connection, type ExecutedQuery } from "@planetscale/database";
import { decrypt } from "./encryption";

// Local type matching Prisma UserIntegration model
interface UserIntegrationPlanetScale {
  planetscaleHost: string | null;
  planetscaleUsername: string | null;
  planetscalePassword: string | null;
  planetscaleDatabaseName: string | null;
}

/**
 * Creates a PlanetScale connection from the user's stored credentials
 */
export function createPlanetScaleClientFromIntegration(
  integration: UserIntegrationPlanetScale
): Connection {
  if (!integration.planetscaleHost || !integration.planetscaleUsername || !integration.planetscalePassword) {
    throw new Error("PlanetScale credentials not configured");
  }

  const host = decrypt(integration.planetscaleHost);
  const username = decrypt(integration.planetscaleUsername);
  const password = decrypt(integration.planetscalePassword);

  return connect({ host, username, password });
}

/**
 * Tests a PlanetScale connection
 */
export async function testPlanetScaleConnection(
  host: string,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const conn = connect({ host, username, password });
    await conn.execute("SELECT 1");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Get list of all tables in the PlanetScale database
 */
export async function getPlanetScaleTables(
  conn: Connection
): Promise<Array<{ name: string; type: string; rowCount: number }>> {
  const result = await conn.execute(
    "SELECT TABLE_NAME as name, TABLE_TYPE as type, TABLE_ROWS as row_count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
  );

  return result.rows.map((row) => ({
    name: String((row as Record<string, unknown>).name ?? ""),
    type: String((row as Record<string, unknown>).type ?? "BASE TABLE") === "BASE TABLE" ? "table" : "view",
    rowCount: Number((row as Record<string, unknown>).row_count ?? 0),
  }));
}

/**
 * Get column schema for a specific table
 */
export async function getPlanetScaleTableSchema(
  conn: Connection,
  tableName: string
): Promise<Array<{
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}>> {
  const result = await conn.execute(
    `SELECT 
      COLUMN_NAME as column_name,
      DATA_TYPE as data_type,
      IS_NULLABLE as is_nullable,
      COLUMN_DEFAULT as column_default,
      COLUMN_KEY as column_key
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION`,
    [tableName]
  );

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      column_name: String(r.column_name ?? ""),
      data_type: String(r.data_type ?? "varchar"),
      is_nullable: String(r.is_nullable ?? "YES"),
      column_default: r.column_default !== null ? String(r.column_default ?? "") : null,
      is_primary_key: String(r.column_key ?? "") === "PRI",
    };
  });
}

/**
 * Execute a raw SQL query on PlanetScale
 */
export async function executePlanetScaleQuery(
  conn: Connection,
  sql: string,
  args?: (string | number | boolean | null)[]
): Promise<ExecutedQuery> {
  return conn.execute(sql, args);
}

/**
 * Build a CREATE TABLE SQL statement for MySQL/PlanetScale
 */
export function buildPlanetScaleCreateTableSQL(
  tableName: string,
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    defaultValue?: string;
    isPrimary?: boolean;
    isUnique?: boolean;
  }>
): string {
  const colDefs = [
    "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY",
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
    ...columns.map((col) => {
      const parts = [`\`${col.name}\` ${col.type}`];
      if (!col.nullable) parts.push("NOT NULL");
      if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
      if (col.isUnique && !col.isPrimary) parts.push("UNIQUE");
      return parts.join(" ");
    }),
  ];

  return `CREATE TABLE \`${tableName}\` (\n  ${colDefs.join(",\n  ")}\n);`;
}
