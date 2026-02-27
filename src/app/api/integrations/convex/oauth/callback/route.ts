import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/integrations/encryption";
import { exchangeConvexOAuthCode } from "@/lib/integrations/convex-client";
import { getCurrentUserId, logIntegrationOperation } from "@/lib/integrations/auth-check";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/integrations/convex?error=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/integrations/convex?error=missing_params",
          request.url
        )
      );
    }

    // Verify CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("convex_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/integrations/convex?error=invalid_state",
          request.url
        )
      );
    }

    // Clear the state cookie
    cookieStore.delete("convex_oauth_state");

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations/convex?error=unauthorized", request.url)
      );
    }

    const redirectUri = process.env.NEXT_PUBLIC_CONVEX_REDIRECT_URI ?? "";

    // Exchange code for tokens
    const tokens = await exchangeConvexOAuthCode(code, redirectUri);

    // Save encrypted tokens
    await db.userIntegration.upsert({
      where: {
        userId_provider: { userId, provider: "convex" },
      },
      create: {
        userId,
        provider: "convex",
        convexAccessToken: encrypt(tokens.access_token),
        convexRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        isActive: true,
      },
      update: {
        convexAccessToken: encrypt(tokens.access_token),
        convexRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        isActive: true,
        connectedAt: new Date(),
      },
    });

    await logIntegrationOperation({
      userId,
      provider: "convex",
      action: "connect",
      status: "success",
    });

    return NextResponse.redirect(
      new URL("/dashboard/integrations/convex?connected=true", request.url)
    );
  } catch (error) {
    console.error("Convex OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/dashboard/integrations/convex?error=${encodeURIComponent(
          error instanceof Error ? error.message : "oauth_failed"
        )}`,
        request.url
      )
    );
  }
}
