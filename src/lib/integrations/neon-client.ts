import { neon } from "@neondatabase/serverless";
import { decrypt } from "./encryption";

// Local type matching Prisma UserIntegration model
interface UserIntegrationNeon {
  neonConnectionString: string | null;
  neonProjectId: string | null;
  neonDatabaseName: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NeonSql = ReturnType<typeof neon>;

/**
 * Creates a Neon SQL function from the user's stored credentials
 */
export function createNeonClientFromIntegration(
  integration: UserIntegrationNeon
): NeonSql {
  if (!integration.neonConnectionString) {
    throw new Error("Neon connection string not configured");
  }

  const connectionString = decrypt(integration.neonConnectionString);
  return neon(connectionString);
}

/**
 * Tests a Neon connection
 */
export async function testNeonConnection(
  connectionString: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sql = neon(connectionString);
    await sql`SELECT 1`;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Get list of all tables in the Neon database
 */
export async function getNeonTables(
  sql: NeonSql
): Promise<Array<{ name: string; type: string; rowCount: number }>> {
  const result = await sql`
    SELECT 
      table_name as name,
      table_type as type
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  const tables = (result as Record<string, unknown>[]).map((row) => ({
    name: String(row.name ?? ""),
    type: String(row.type ?? "BASE TABLE") === "BASE TABLE" ? "table" : "view",
    rowCount: 0,
  }));

  // Get row counts using parameterized queries
  for (const table of tables) {
    try {
      const countResult = await sql`SELECT COUNT(*) as count FROM ${sql.unsafe(`"${table.name}"`)}`;
      table.rowCount = Number((countResult as Record<string, unknown>[])[0]?.count ?? 0);
    } catch {
      // Ignore count errors for views
    }
  }

  return tables;
}

/**
 * Get column schema for a specific table
 */
export async function getNeonTableSchema(
  sql: NeonSql,
  tableName: string
): Promise<Array<{
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}>> {
  const result = await sql`
    SELECT 
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
        AND tc.table_name = ku.table_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = ${tableName}
    ) pk ON c.column_name = pk.column_name
    WHERE c.table_schema = 'public' AND c.table_name = ${tableName}
    ORDER BY c.ordinal_position
  `;

  return (result as Record<string, unknown>[]).map((row) => ({
    column_name: String(row.column_name ?? ""),
    data_type: String(row.data_type ?? "text"),
    is_nullable: String(row.is_nullable ?? "YES"),
    column_default: row.column_default !== null ? String(row.column_default ?? "") : null,
    is_primary_key: Boolean(row.is_primary_key),
  }));
}

/**
 * Build a CREATE TABLE SQL statement for PostgreSQL/Neon
 */
export function buildNeonCreateTableSQL(
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
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid()",
    "created_at timestamptz DEFAULT now()",
    ...columns.map((col) => {
      const parts = [`"${col.name}" ${col.type}`];
      if (!col.nullable) parts.push("NOT NULL");
      if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
      if (col.isUnique && !col.isPrimary) parts.push("UNIQUE");
      return parts.join(" ");
    }),
  ];

  return `CREATE TABLE "${tableName}" (\n  ${colDefs.join(",\n  ")}\n);`;
}
