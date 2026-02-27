import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const clientId = process.env.SUPABASE_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    // Return a helpful error page instead of crashing
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Not Configured</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; }
    h1 { color: #f87171; margin-top: 0; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; color: #7dd3fc; }
    .back { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border-radius: 6px; text-decoration: none; }
    .back:hover { background: #2563eb; }
    pre { background: #0f172a; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.8em; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚠️ Supabase OAuth Not Configured</h1>
    <p>The Supabase OAuth App credentials are not set up yet.</p>
    <p>To use OAuth, add these to your <code>.env.local</code>:</p>
    <pre>SUPABASE_CLIENT_ID=your_client_id
SUPABASE_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_SUPABASE_REDIRECT_URI=http://localhost:3000/api/integrations/supabase/oauth/callback</pre>
    <p>Register your OAuth App at: <a href="https://supabase.com/dashboard/org/oauth" target="_blank" style="color: #7dd3fc;">supabase.com/dashboard/org/oauth</a></p>
    <p><strong>Alternative:</strong> Use the <strong>API Key (Manual)</strong> tab instead — it works without any OAuth setup!</p>
    <a href="/dashboard/integrations/supabase" class="back">← Back to Supabase Dashboard</a>
  </div>
</body>
</html>`,
      {
        status: 400,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString("hex");

  // Store state in cookie for CSRF protection
  const cookieStore = await cookies();
  cookieStore.set("supabase_oauth_state", state, {
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
    scope: "all",
    state,
  });

  const authUrl = `https://api.supabase.com/v1/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
