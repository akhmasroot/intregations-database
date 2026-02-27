import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/integrations/encryption";
import { testNeonConnection } from "@/lib/integrations/neon-client";
import { getCurrentUserId, logIntegrationOperation, successResponse, errorResponse, checkRateLimit } from "@/lib/integrations/auth-check";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    if (!checkRateLimit(userId, "neon")) return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), { status: 429 });

    const body = await request.json();
    const { connectionString, databaseName, testOnly = false } = body;

    if (!connectionString) return NextResponse.json(errorResponse("INVALID_CREDENTIALS", "Connection string is required"), { status: 400 });

    const testResult = await testNeonConnection(connectionString);
    if (!testResult.success) {
      await logIntegrationOperation({ userId, provider: "neon", action: "connect", status: "error", errorMessage: testResult.error });
      return NextResponse.json(errorResponse("CONNECTION_FAILED", testResult.error ?? "Connection test failed"), { status: 400 });
    }

    if (testOnly) return NextResponse.json(successResponse({ message: "Connection test successful" }));

    // Extract database name from connection string if not provided
    const dbNameFromUrl = connectionString.match(/\/([^/?]+)(\?|$)/)?.[1];

    await db.userIntegration.upsert({
      where: { userId_provider: { userId, provider: "neon" } },
      create: { userId, provider: "neon", neonConnectionString: encrypt(connectionString), neonDatabaseName: databaseName ?? dbNameFromUrl ?? null, isActive: true },
      update: { neonConnectionString: encrypt(connectionString), neonDatabaseName: databaseName ?? dbNameFromUrl ?? null, isActive: true, connectedAt: new Date() },
    });

    await logIntegrationOperation({ userId, provider: "neon", action: "connect", status: "success" });
    return NextResponse.json(successResponse({ message: "Neon connected successfully" }));
  } catch (error) {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", "Failed to save connection"), { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    await db.userIntegration.update({ where: { userId_provider: { userId, provider: "neon" } }, data: { isActive: false } });
    return NextResponse.json(successResponse({ message: "Disconnected" }));
  } catch {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", "Failed to disconnect"), { status: 500 });
  }
}
