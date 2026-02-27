import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/integrations/encryption";
import { testTursoConnection } from "@/lib/integrations/turso-client";
import {
  getCurrentUserId,
  logIntegrationOperation,
  successResponse,
  errorResponse,
  checkRateLimit,
} from "@/lib/integrations/auth-check";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    if (!checkRateLimit(userId, "turso")) {
      return NextResponse.json(
        errorResponse("RATE_LIMITED", "Too many requests. Please wait before trying again."),
        { status: 429 }
      );
    }

    const body = await request.json();
    const { databaseUrl, authToken, databaseName, testOnly = false } = body;

    if (!databaseUrl || !authToken) {
      return NextResponse.json(
        errorResponse("INVALID_CREDENTIALS", "Database URL and Auth Token are required"),
        { status: 400 }
      );
    }

    // Test the connection
    const testResult = await testTursoConnection(databaseUrl, authToken);

    if (!testResult.success) {
      await logIntegrationOperation({
        userId,
        provider: "turso",
        action: "connect",
        status: "error",
        errorMessage: testResult.error,
      });

      return NextResponse.json(
        errorResponse("CONNECTION_FAILED", testResult.error ?? "Connection test failed"),
        { status: 400 }
      );
    }

    // If test only, return success without saving
    if (testOnly) {
      return NextResponse.json(successResponse({ message: "Connection test successful" }));
    }

    // Encrypt and save credentials
    await db.userIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: "turso",
        },
      },
      create: {
        userId,
        provider: "turso",
        tursoUrl: encrypt(databaseUrl),
        tursoAuthToken: encrypt(authToken),
        tursoDatabaseName: databaseName ?? null,
        isActive: true,
      },
      update: {
        tursoUrl: encrypt(databaseUrl),
        tursoAuthToken: encrypt(authToken),
        tursoDatabaseName: databaseName ?? null,
        isActive: true,
        connectedAt: new Date(),
      },
    });

    await logIntegrationOperation({
      userId,
      provider: "turso",
      action: "connect",
      status: "success",
    });

    return NextResponse.json(
      successResponse({ message: "Turso connected successfully" })
    );
  } catch (error) {
    console.error("Turso connect error:", error);
    return NextResponse.json(
      errorResponse(
        "INTERNAL_ERROR",
        "Failed to save connection",
        error instanceof Error ? error.message : undefined
      ),
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    await db.userIntegration.update({
      where: {
        userId_provider: { userId, provider: "turso" },
      },
      data: { isActive: false },
    });

    await logIntegrationOperation({
      userId,
      provider: "turso",
      action: "disconnect",
      status: "success",
    });

    return NextResponse.json(successResponse({ message: "Disconnected successfully" }));
  } catch {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to disconnect"),
      { status: 500 }
    );
  }
}
