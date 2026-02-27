import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUserId,
  validateIntegrationAccess,
  logIntegrationOperation,
  successResponse,
  errorResponse,
} from "@/lib/integrations/auth-check";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(errorResponse("UNAUTHORIZED", "Not authenticated"), {
        status: 401,
      });
    }

    await validateIntegrationAccess(userId, "convex");

    const body = await request.json();
    const { collectionName, fields } = body;

    if (!collectionName || !fields?.length) {
      return NextResponse.json(
        errorResponse("INVALID_REQUEST", "Collection name and fields are required"),
        { status: 400 }
      );
    }

    // Generate schema snippet for the user
    const fieldDefs = fields.map((f: { name: string; type: string; optional?: boolean }) => {
      const type = f.optional && !f.type.startsWith("v.optional")
        ? `v.optional(${f.type})`
        : f.type;
      return `    ${f.name}: ${type},`;
    });

    const schemaSnippet = `// Add to your convex/schema.ts:
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ${collectionName}: defineTable({
${fieldDefs.join("\n")}
  }),
});`;

    await logIntegrationOperation({
      userId,
      provider: "convex",
      action: "create_table",
      tableName: collectionName,
      status: "success",
    });

    // Note: Convex doesn't support creating tables via API directly.
    // The schema must be defined in code and deployed.
    // We return the schema snippet for the user to copy.
    return NextResponse.json(
      successResponse({
        message: `Schema snippet generated for "${collectionName}". Add this to your convex/schema.ts and deploy.`,
        schemaSnippet,
        collectionName,
      })
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "Failed to generate schema"),
      { status: 500 }
    );
  }
}
