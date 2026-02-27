import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/integrations/encryption";
import { getCurrentUserId, logIntegrationOperation } from "@/lib/integrations/auth-check";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/integrations/supabase?error=${encodeURIComponent(errorDescription ?? error)}`,
          request.url
        )
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations/supabase?error=missing_params", request.url)
      );
    }

    // Verify CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("supabase_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations/supabase?error=invalid_state", request.url)
      );
    }

    // Clear the state cookie
    cookieStore.delete("supabase_oauth_state");

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations/supabase?error=unauthorized", request.url)
      );
    }

    const clientId = process.env.SUPABASE_CLIENT_ID;
    const clientSecret = process.env.SUPABASE_CLIENT_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations/supabase?error=oauth_not_configured", request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://api.supabase.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Supabase OAuth token error:", errorText);
      return NextResponse.redirect(
        new URL(
          `/dashboard/integrations/supabase?error=${encodeURIComponent("Token exchange failed")}`,
          request.url
        )
      );
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations/supabase?error=no_access_token", request.url)
      );
    }

    // Get user's Supabase projects to find the project URL
    // For now, save the OAuth token - user can select project later
    await db.userIntegration.upsert({
      where: {
        userId_provider: { userId, provider: "supabase" },
      },
      create: {
        userId,
        provider: "supabase",
        // Store OAuth token as the anon key field (encrypted)
        // In a real implementation, you'd use this to fetch project credentials
        supabaseAnonKey: encrypt(accessToken),
        supabaseServiceKey: refreshToken ? encrypt(refreshToken) : null,
        isActive: true,
      },
      update: {
        supabaseAnonKey: encrypt(accessToken),
        supabaseServiceKey: refreshToken ? encrypt(refreshToken) : null,
        isActive: true,
        connectedAt: new Date(),
      },
    });

    await logIntegrationOperation({
      userId,
      provider: "supabase",
      action: "connect",
      status: "success",
      metadata: { method: "oauth" },
    });

    return NextResponse.redirect(
      new URL("/dashboard/integrations/supabase?connected=true", request.url)
    );
  } catch (error) {
    console.error("Supabase OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/dashboard/integrations/supabase?error=${encodeURIComponent(
          error instanceof Error ? error.message : "oauth_failed"
        )}`,
        request.url
      )
    );
  }
}
