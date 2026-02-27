import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/integrations/encryption";
import { testPlanetScaleConnection } from "@/lib/integrations/planetscale-client";
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
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    }

    if (!checkRateLimit(userId, "planetscale")) {
      return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), { status: 429 });
    }

    const body = await request.json();
    const { host, username, password, databaseName, testOnly = false } = body;

    if (!host || !username || !password) {
      return NextResponse.json(errorResponse("INVALID_CREDENTIALS", "Host, username, and password are required"), { status: 400 });
    }

    const testResult = await testPlanetScaleConnection(host, username, password);

    if (!testResult.success) {
      await logIntegrationOperation({ userId, provider: "planetscale", action: "connect", status: "error", errorMessage: testResult.error });
      return NextResponse.json(errorResponse("CONNECTION_FAILED", testResult.error ?? "Connection test failed"), { status: 400 });
    }

    if (testOnly) {
      return NextResponse.json(successResponse({ message: "Connection test successful" }));
    }

    await db.userIntegration.upsert({
      where: { userId_provider: { userId, provider: "planetscale" } },
      create: {
        userId,
        provider: "planetscale",
        planetscaleHost: encrypt(host),
        planetscaleUsername: encrypt(username),
        planetscalePassword: encrypt(password),
        planetscaleDatabaseName: databaseName ?? null,
        isActive: true,
      },
      update: {
        planetscaleHost: encrypt(host),
        planetscaleUsername: encrypt(username),
        planetscalePassword: encrypt(password),
        planetscaleDatabaseName: databaseName ?? null,
        isActive: true,
        connectedAt: new Date(),
      },
    });

    await logIntegrationOperation({ userId, provider: "planetscale", action: "connect", status: "success" });
    return NextResponse.json(successResponse({ message: "PlanetScale connected successfully" }));
  } catch (error) {
    console.error("PlanetScale connect error:", error);
    return NextResponse.json(errorResponse("INTERNAL_ERROR", "Failed to save connection"), { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    }
    await db.userIntegration.update({
      where: { userId_provider: { userId, provider: "planetscale" } },
      data: { isActive: false },
    });
    return NextResponse.json(successResponse({ message: "Disconnected" }));
  } catch {
    return NextResponse.json(errorResponse("INTERNAL_ERROR", "Failed to disconnect"), { status: 500 });
  }
}
