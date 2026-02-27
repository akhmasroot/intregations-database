import { db } from "@/lib/db";
import { headers } from "next/headers";

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Get the current user ID from the session.
 * This is a placeholder - replace with your actual auth implementation
 * (NextAuth, Clerk, Supabase Auth, etc.)
 */
export async function getCurrentUserId(): Promise<string | null> {
  // TODO: Replace with your actual auth implementation
  // Example with NextAuth:
  // const session = await getServerSession(authOptions);
  // return session?.user?.id ?? null;
  
  // Example with Clerk:
  // const { userId } = auth();
  // return userId;
  
  // For development/demo purposes, return a mock user ID
  // In production, this MUST be replaced with real auth
  const headersList = await headers();
  const userId = headersList.get("x-user-id");
  return userId ?? "demo-user-id";
}

/**
 * Validates that the current user has access to the specified integration.
 * Throws an error if the user is not authenticated or doesn't own the integration.
 */
export async function validateIntegrationAccess(
  userId: string,
  provider: string
) {
  const integration = await db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!integration) {
    throw new IntegrationError(
      "INTEGRATION_NOT_FOUND",
      `No ${provider} integration found for this user`
    );
  }

  if (!integration.isActive) {
    throw new IntegrationError(
      "INTEGRATION_INACTIVE",
      `${provider} integration is inactive`
    );
  }

  return integration;
}

/**
 * Check rate limit for a user+provider combination.
 * Returns true if within limit, false if rate limited.
 */
export function checkRateLimit(userId: string, provider: string): boolean {
  const key = `${userId}:${provider}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get remaining time until rate limit resets (in seconds)
 */
export function getRateLimitResetTime(userId: string, provider: string): number {
  const key = `${userId}:${provider}`;
  const entry = rateLimitStore.get(key);
  if (!entry) return 0;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

/**
 * Log an integration operation to the audit trail
 */
export async function logIntegrationOperation(params: {
  userId: string;
  provider: string;
  action: string;
  tableName?: string;
  status: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.userIntegrationLog.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        action: params.action,
        tableName: params.tableName,
        status: params.status,
        errorMessage: params.errorMessage,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch {
    // Don't fail the main operation if logging fails
    console.error("Failed to log integration operation");
  }
}

/**
 * Custom error class for integration-related errors
 */
export class IntegrationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

/**
 * Standard API response format
 */
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Create a success response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === "development" && details ? { details } : {}),
    },
  };
}
