# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Database Integration Dashboard implemented

The template now includes a full Database Integration Dashboard allowing SaaS users to connect their Supabase or Convex databases and perform CRUD operations directly from the dashboard.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] shadcn/ui integration with CSS variables, Button component, and cn() utility
- [x] Database Integration Dashboard (Supabase + Convex)
  - [x] Prisma 7 schema with UserIntegration and UserIntegrationLog models (SQLite via libsql)
  - [x] AES-256-CBC encryption utility for secure credential storage
  - [x] Auth-check helper with rate limiting (100 req/min) and audit logging
  - [x] Supabase client factory with dynamic credential loading
  - [x] Convex client factory with OAuth token management
  - [x] Main integrations page with provider cards and connection status
  - [x] Supabase dashboard: database explorer, table CRUD, SQL editor, table creator
  - [x] Convex dashboard: project explorer, document CRUD, collection creator
  - [x] All API routes for both providers
  - [x] Shared components: data-table, schema-viewer, column-type-selector, etc.
  - [x] Sonner toast notifications integrated in root layout

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
