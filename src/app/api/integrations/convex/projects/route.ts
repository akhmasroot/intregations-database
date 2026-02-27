import { NextResponse } from "next/server";
import {
  getConvexAccessToken,
  listConvexProjects,
} from "@/lib/integrations/convex-client";
import {
  getCurrentUserId,
  validateIntegrationAccess,
  checkRateLimit,
  successResponse,
  errorResponse,
} from "@/lib/integrations/auth-check";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    if (!checkRateLimit(userId, "convex")) {
      return NextResponse.json(errorResponse("RATE_LIMITED", "Too many requests"), {
        status: 429,
      });
    }

    const integration = await validateIntegrationAccess(userId, "convex");
    const accessToken = await getConvexAccessToken(integration);

    const projects = await listConvexProjects(accessToken);

    return NextResponse.json(successResponse({ projects }));
  } catch (error) {
    console.error("Convex projects error:", error);
    return NextResponse.json(
      errorResponse(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Failed to fetch projects"
      ),
      { status: 500 }
    );
  }
}
