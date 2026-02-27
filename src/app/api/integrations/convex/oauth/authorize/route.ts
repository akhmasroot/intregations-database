import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const clientId = process.env.CONVEX_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_CONVEX_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Convex OAuth not configured. Set CONVEX_CLIENT_ID and NEXT_PUBLIC_CONVEX_REDIRECT_URI." },
      { status: 500 }
    );
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString("hex");

  // Store state in cookie for CSRF protection
  const cookieStore = await cookies();
  cookieStore.set("convex_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state,
  });

  const authUrl = `https://auth.convex.dev/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
