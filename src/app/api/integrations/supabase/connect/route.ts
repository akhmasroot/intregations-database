import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/integrations/encryption";
import { testSupabaseConnection } from "@/lib/integrations/supabase-client";
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

    if (!checkRateLimit(userId, "supabase")) {
      return NextResponse.json(
        errorResponse("RATE_LIMITED", "Too many requests. Please wait before trying again."),
        { status: 429 }
      );
    }

    const body = await request.json();
    const { projectUrl, anonKey, serviceKey, testOnly = false } = body;

    if (!projectUrl || !anonKey) {
      return NextResponse.json(
        errorResponse("INVALID_CREDENTIALS", "Project URL and Anon Key are required"),
        { status: 400 }
      );
    }

    // Test the connection
    const testResult = await testSupabaseConnection(projectUrl, anonKey);

    if (!testResult.success) {
      await logIntegrationOperation({
        userId,
        provider: "supabase",
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

    // Extract project ref from URL
    const projectRef = projectUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

    // Encrypt and save credentials
    await db.userIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: "supabase",
        },
      },
      create: {
        userId,
        provider: "supabase",
        supabaseUrl: encrypt(projectUrl),
        supabaseAnonKey: encrypt(anonKey),
        supabaseServiceKey: serviceKey ? encrypt(serviceKey) : null,
        supabaseProjectRef: projectRef ?? null,
        isActive: true,
      },
      update: {
        supabaseUrl: encrypt(projectUrl),
        supabaseAnonKey: encrypt(anonKey),
        supabaseServiceKey: serviceKey ? encrypt(serviceKey) : null,
        supabaseProjectRef: projectRef ?? null,
        isActive: true,
        connectedAt: new Date(),
      },
    });

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "connect",
      status: "success",
    });

    return NextResponse.json(
      successResponse({ message: "Supabase connected successfully" })
    );
  } catch (error) {
    console.error("Supabase connect error:", error);
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

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    await db.userIntegration.update({
      where: {
        userId_provider: { userId, provider: "supabase" },
      },
      data: { isActive: false },
    });

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "disconnect",
      status: "success",
    });

    return NextResponse.json(successResponse({ message: "Disconnected successfully" }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to disconnect"),
      { status: 500 }
    );
  }
}
