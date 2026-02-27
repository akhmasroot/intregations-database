import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "./encryption";

// Local type matching Prisma UserIntegration model
interface UserIntegration {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceKey: string | null;
  supabaseProjectRef: string | null;
  convexAccessToken: string | null;
  convexRefreshToken: string | null;
  convexDeploymentUrl: string | null;
  convexProjectId: string | null;
}

/**
 * Creates a Supabase client using the user's stored credentials.
 * Uses service key if available (for admin operations), otherwise uses anon key.
 */
export function createSupabaseClientFromIntegration(
  integration: UserIntegration,
  useServiceKey = false
): SupabaseClient {
  if (!integration.supabaseUrl || !integration.supabaseAnonKey) {
    throw new Error("Supabase credentials not configured");
  }

  const url = decrypt(integration.supabaseUrl);
  
  let key: string;
  if (useServiceKey && integration.supabaseServiceKey) {
    key = decrypt(integration.supabaseServiceKey);
  } else {
    key = decrypt(integration.supabaseAnonKey);
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a Supabase admin client (using service role key).
 * This bypasses Row Level Security - use with caution.
 */
export function createSupabaseAdminClient(
  integration: UserIntegration
): SupabaseClient {
  return createSupabaseClientFromIntegration(integration, true);
}

/**
 * Tests a Supabase connection by running a simple query.
 * Returns true if connection is successful.
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Test connection using the REST API health check
    // Supabase PostgREST doesn't expose information_schema, so we use a different approach
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    // A 200 or 400 response means the server is reachable and credentials are valid
    // 401 means invalid credentials
    if (response.status === 401) {
      return { success: false, error: "Invalid API key" };
    }

    if (!response.ok && response.status !== 400) {
      return { success: false, error: `Server returned ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Get list of tables from a Supabase project using the REST API
 */
export async function getSupabaseTables(
  client: SupabaseClient
): Promise<Array<{ name: string; type: string; rowCount: number }>> {
  const { data, error } = await client.rpc("get_tables_info").select("*");
  
  if (error) {
    // Fallback: use raw SQL via rpc
    const { data: sqlData, error: sqlError } = await client.rpc("exec_sql", {
      query: `
        SELECT 
          table_name as name,
          table_type as type,
          0 as row_count
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `,
    });
    
    if (sqlError) throw new Error(sqlError.message);
    return sqlData ?? [];
  }
  
  return data ?? [];
}

/**
 * Get column schema for a specific table
 */
export async function getTableSchema(
  client: SupabaseClient,
  tableName: string
): Promise<Array<{
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}>> {
  const { data, error } = await client
    .from("information_schema.columns")
    .select("column_name, data_type, is_nullable, column_default")
    .eq("table_schema", "public")
    .eq("table_name", tableName)
    .order("ordinal_position");

  if (error) throw new Error(error.message);
  
  return (data ?? []).map((col) => ({
    ...col,
    is_primary_key: false, // Would need additional query to determine
  }));
}
