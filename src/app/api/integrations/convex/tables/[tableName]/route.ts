import { NextRequest, NextResponse } from "next/server";
import {
  getConvexAccessToken,
  queryConvexDocuments,
  insertConvexDocument,
  convexDeploymentRequest,
} from "@/lib/integrations/convex-client";
import {
  getCurrentUserId,
  validateIntegrationAccess,
  logIntegrationOperation,
  checkRateLimit,
  successResponse,
  errorResponse,
} from "@/lib/integrations/auth-check";

interface RouteParams {
  params: Promise<{ tableName: string }>;
}

async function getDeploymentUrl(integration: { convexDeploymentUrl: string | null }): Promise<string> {
  if (!integration.convexDeploymentUrl) {
    throw new Error("No deployment URL configured");
  }
  return integration.convexDeploymentUrl;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
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
    const deploymentUrl = await getDeploymentUrl(integration);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);

    const result = await queryConvexDocuments(deploymentUrl, accessToken, tableName, {
      limit,
    });

    await logIntegrationOperation({
      userId,
      provider: "convex",
      action: "query",
      tableName,
      status: "success",
    });

    return NextResponse.json(
      successResponse({
        documents: result.documents,
        totalCount: result.documents.length,
        page,
        limit,
        cursor: result.cursor,
      })
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to fetch documents"),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    const integration = await validateIntegrationAccess(userId, "convex");
    const accessToken = await getConvexAccessToken(integration);
    const deploymentUrl = await getDeploymentUrl(integration);

    const body = await request.json();
    const { document } = body;

    const result = await insertConvexDocument(deploymentUrl, accessToken, tableName, document);

    await logIntegrationOperation({
      userId,
      provider: "convex",
      action: "insert",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ id: result.id }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Insert failed"),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    const integration = await validateIntegrationAccess(userId, "convex");
    const accessToken = await getConvexAccessToken(integration);
    const deploymentUrl = await getDeploymentUrl(integration);

    const body = await request.json();
    const { document } = body;

    if (!document?._id) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Document _id is required"),
        { status: 400 }
      );
    }

    const { _id, _creationTime, ...updateData } = document;

    await convexDeploymentRequest(deploymentUrl, accessToken, "/api/mutation", {
      method: "POST",
      body: JSON.stringify({
        path: `${tableName}:update`,
        args: { id: _id, ...updateData },
      }),
    });

    await logIntegrationOperation({
      userId,
      provider: "convex",
      action: "update",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ message: "Document updated" }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Update failed"),
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { tableName } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    const integration = await validateIntegrationAccess(userId, "convex");
    const accessToken = await getConvexAccessToken(integration);
    const deploymentUrl = await getDeploymentUrl(integration);

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Document id is required"),
        { status: 400 }
      );
    }

    await convexDeploymentRequest(deploymentUrl, accessToken, "/api/mutation", {
      method: "POST",
      body: JSON.stringify({
        path: `${tableName}:delete`,
        args: { id },
      }),
    });

    await logIntegrationOperation({
      userId,
      provider: "convex",
      action: "delete",
      tableName,
      status: "success",
    });

    return NextResponse.json(successResponse({ message: "Document deleted" }));
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Delete failed"),
      { status: 500 }
    );
  }
}
