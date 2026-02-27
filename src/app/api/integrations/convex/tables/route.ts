import { NextRequest, NextResponse } from "next/server";
import {
  getConvexAccessToken,
  listConvexTables,
  convexApiRequest,
} from "@/lib/integrations/convex-client";
import {
  getCurrentUserId,
  validateIntegrationAccess,
  checkRateLimit,
  successResponse,
  errorResponse,
} from "@/lib/integrations/auth-check";
import { decrypt } from "@/lib/integrations/encryption";

export async function GET(request: NextRequest) {
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

    const projectId = request.nextUrl.searchParams.get("projectId");

    // Get deployment URL for the project
    let deploymentUrl = integration.convexDeploymentUrl;
    
    if (projectId && !deploymentUrl) {
      // Fetch project details to get deployment URL
      try {
        const projectData = await convexApiRequest<{ deploymentUrl?: string }>(
          accessToken,
          `/api/projects/${projectId}`
        );
        deploymentUrl = projectData.deploymentUrl ?? null;
      } catch {
        // Use stored deployment URL if available
      }
    }

    if (!deploymentUrl) {
      return NextResponse.json(
        errorResponse("CONFIGURATION_ERROR", "No deployment URL configured"),
        { status: 400 }
      );
    }

    const decryptedUrl = deploymentUrl.includes(":") 
      ? decrypt(deploymentUrl) 
      : deploymentUrl;

    const tables = await listConvexTables(decryptedUrl, accessToken);

    return NextResponse.json(successResponse({ tables }));
  } catch (error) {
    console.error("Convex tables error:", error);
    return NextResponse.json(
      errorResponse(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Failed to fetch tables"
      ),
      { status: 500 }
    );
  }
}
