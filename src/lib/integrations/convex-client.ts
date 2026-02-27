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

export interface ConvexProject {
  id: string;
  name: string;
  slug: string;
  deploymentUrl: string;
  teamId: string;
}

export interface ConvexTable {
  name: string;
  documentCount: number;
}

export interface ConvexDocument {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
}

/**
 * Get the access token from the integration, refreshing if needed
 */
export async function getConvexAccessToken(
  integration: UserIntegration
): Promise<string> {
  if (!integration.convexAccessToken) {
    throw new Error("Convex access token not configured");
  }

  const accessToken = decrypt(integration.convexAccessToken);
  
  // TODO: Check token expiry and refresh if needed
  // For now, return the stored token
  return accessToken;
}

/**
 * Make an authenticated request to the Convex API
 */
export async function convexApiRequest<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`https://api.convex.dev${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Convex API error (${response.status}): ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * List all Convex projects for the authenticated user
 */
export async function listConvexProjects(
  accessToken: string
): Promise<ConvexProject[]> {
  const data = await convexApiRequest<{ projects: ConvexProject[] }>(
    accessToken,
    "/api/teams/self/projects"
  );
  return data.projects ?? [];
}

/**
 * Make a request to a specific Convex deployment
 */
export async function convexDeploymentRequest<T>(
  deploymentUrl: string,
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${deploymentUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Convex deployment error (${response.status}): ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * List tables/collections in a Convex deployment
 */
export async function listConvexTables(
  deploymentUrl: string,
  accessToken: string
): Promise<ConvexTable[]> {
  try {
    const data = await convexDeploymentRequest<{ tables: ConvexTable[] }>(
      deploymentUrl,
      accessToken,
      "/api/tables"
    );
    return data.tables ?? [];
  } catch {
    // Fallback: try to get schema
    return [];
  }
}

/**
 * Query documents from a Convex table
 */
export async function queryConvexDocuments(
  deploymentUrl: string,
  accessToken: string,
  tableName: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<{ documents: ConvexDocument[]; cursor?: string }> {
  const params = new URLSearchParams({
    table: tableName,
    ...(options.limit ? { numItems: options.limit.toString() } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
  });

  const data = await convexDeploymentRequest<{
    results: ConvexDocument[];
    continueCursor?: string;
  }>(
    deploymentUrl,
    accessToken,
    `/api/query?${params.toString()}`
  );

  return {
    documents: data.results ?? [],
    cursor: data.continueCursor,
  };
}

/**
 * Insert a document into a Convex table
 */
export async function insertConvexDocument(
  deploymentUrl: string,
  accessToken: string,
  tableName: string,
  document: Record<string, unknown>
): Promise<{ id: string }> {
  const data = await convexDeploymentRequest<{ id: string }>(
    deploymentUrl,
    accessToken,
    "/api/mutation",
    {
      method: "POST",
      body: JSON.stringify({
        path: `${tableName}:insert`,
        args: document,
      }),
    }
  );
  return data;
}

/**
 * Exchange OAuth authorization code for access token
 */
export async function exchangeConvexOAuthCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const response = await fetch("https://auth.convex.dev/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.CONVEX_CLIENT_ID ?? "",
      client_secret: process.env.CONVEX_CLIENT_SECRET ?? "",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Refresh a Convex OAuth access token
 */
export async function refreshConvexToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const response = await fetch("https://auth.convex.dev/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.CONVEX_CLIENT_ID ?? "",
      client_secret: process.env.CONVEX_CLIENT_SECRET ?? "",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json();
}
