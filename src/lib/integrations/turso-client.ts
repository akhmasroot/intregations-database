import { createClient, type Client, type ResultSet } from "@libsql/client";
import { decrypt } from "./encryption";

// Local type matching Prisma UserIntegration model
interface UserIntegrationTurso {
  tursoUrl: string | null;
  tursoAuthToken: string | null;
  tursoDatabaseName: string | null;
}

/**
 * Creates a Turso (libsql) client from the user's stored credentials
 */
export function createTursoClientFromIntegration(
  integration: UserIntegrationTurso
): Client {
  if (!integration.tursoUrl || !integration.tursoAuthToken) {
    throw new Error("Turso credentials not configured");
  }

  const url = decrypt(integration.tursoUrl);
  const authToken = decrypt(integration.tursoAuthToken);

  return createClient({ url, authToken });
}

/**
 * Tests a Turso connection by running a simple query
 */
export async function testTursoConnection(
  url: string,
  authToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient({ url, authToken });
    await client.execute("SELECT 1");
    client.close();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Get list of all tables in the Turso database
 */
export async function getTursoTables(
  client: Client
): Promise<Array<{ name: string; type: string; rowCount: number }>> {
  const result = await client.execute(
    "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );

  const tables = result.rows.map((row) => ({
    name: String(row[0] ?? row.name ?? ""),
    type: String(row[1] ?? row.type ?? "table"),
    rowCount: 0,
  }));

  // Get row counts for each table
  for (const table of tables) {
    try {
      const countResult = await client.execute(
        `SELECT COUNT(*) as count FROM "${table.name}"`
      );
      table.rowCount = Number(countResult.rows[0]?.[0] ?? 0);
    } catch {
      // Ignore count errors for views
    }
  }

  return tables;
}

/**
 * Get column schema for a specific table
 */
export async function getTursoTableSchema(
  client: Client,
  tableName: string
): Promise<Array<{
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}>> {
  const result = await client.execute(`PRAGMA table_info("${tableName}")`);

  return result.rows.map((row) => ({
    column_name: String(row[1] ?? row.name ?? ""),
    data_type: String(row[2] ?? row.type ?? "TEXT"),
    is_nullable: row[3] === 0 || row.notnull === 1 ? "NO" : "YES",
    column_default: row[4] !== null ? String(row[4] ?? row.dflt_value ?? "") : null,
    is_primary_key: row[5] === 1 || row.pk === 1,
  }));
}

/**
 * Execute a raw SQL query on Turso
 */
export async function executeTursoQuery(
  client: Client,
  sql: string
): Promise<ResultSet> {
  return client.execute(sql);
}

/**
 * Build a CREATE TABLE SQL statement for SQLite/Turso
 */
export function buildCreateTableSQL(
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
    "id INTEGER PRIMARY KEY AUTOINCREMENT",
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
    ...columns.map((col) => {
      const parts = [`"${col.name}" ${col.type}`];
      if (!col.nullable) parts.push("NOT NULL");
      if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
      if (col.isUnique && !col.isPrimary) parts.push("UNIQUE");
      return parts.join(" ");
    }),
  ];

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs.join(",\n  ")}\n);`;
}
