# Agent Orchestrator Project Instructions

## Monorepo Structure
This is a **monorepo** using **pnpm workspaces** and **Turborepo** for build orchestration.

### Project Structure
```
agent-orchestrator/
├── apps/
│   ├── cli/           # Installation and startup CLI
│   ├── daemon/        # Agent orchestrator daemon (formerly agent-orchestrator-daemon)
│   └── web/           # Next.js web interface (formerly web submodule)
├── packages/
│   └── shared/        # Shared types and utilities
├── supabase/          # Database migrations and config
├── scripts/           # Utility scripts
├── pnpm-workspace.yaml
├── turbo.json
└── package.json       # Root workspace configuration
```

### Package Management
- **Use pnpm** for all package management operations
- Each app/package has its own `package.json`
- Dependencies are hoisted to the root `node_modules` when possible
- Run `pnpm install` from the root to install all dependencies

### Working with the Monorepo
All changes are made within the single repository. You can:
- Edit files in any `apps/*` or `packages/*` directory
- Create commits that span multiple packages
- Use atomic commits for coordinated changes across apps

## Git Workflow

### Branch Protection
The repository has branch protection enabled on the `main` branch:
- **Direct pushes to main are blocked** - all changes must go through pull requests
- **PR approval required** - at least 1 approving review is required before merging
- **Force pushes blocked** - cannot force push to the main branch
- **Branch deletion blocked** - the main branch cannot be deleted
- **Enforced for admins** - administrators must also follow these rules

### Branch Management
- **Always create a new branch** for any code edits or features
- Branch naming convention: Use descriptive names (e.g., `feature/add-auth`, `fix/install-env-vars`, `refactor/cleanup-types`)
- **You cannot push directly to main** - branch protection will reject direct pushes

### Workflow Steps
1. **Start from main branch:**
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a new branch: `git checkout -b <descriptive-branch-name>`
3. Make your changes and commit them
4. **Before pushing, merge main into your branch to resolve conflicts:**
   ```bash
   git fetch origin main
   git merge origin/main
   # Resolve any conflicts if they occur
   # Test your changes after merging to ensure everything still works
   ```
5. Push your feature branch: `git push -u origin <your-branch-name>`
6. Create a Pull Request (PR) to merge into main
7. Wait for code review and approval (if working with a team)
8. Merge the PR on GitHub (or via `gh` CLI)
9. **After PR is merged, clean up locally and return to main:**
   ```bash
   git checkout main
   git pull origin main
   git branch -d <your-branch-name>
   ```
10. **Important:** Always delete your local feature branch after the PR is merged to keep your workspace clean
11. **CRITICAL:** Always return to `main` branch after completing work on a feature - this ensures the next feature starts from a clean state

### Pull Request Guidelines
- Write clear PR titles and descriptions explaining the changes
- Reference any related issues or tickets
- Ensure all tests pass before requesting review
- Respond to review comments promptly
- Keep PRs focused on a single feature or fix for easier review
- Include screenshots or examples for UI changes

## Code Standards
- Follow existing code conventions in the repository
- Ensure TypeScript types are properly defined
- Run tests before merging branches
- Update documentation when adding new features

## Monorepo Commands

### Development
```bash
# Install all dependencies
pnpm install

# Run all apps in dev mode (parallel)
pnpm dev

# Run specific app in dev mode
pnpm dev:daemon
pnpm dev:web

# Build all apps
pnpm build

# Run CLI tools
pnpm install-cli
pnpm start-cli
```

### Package-Specific Commands
```bash
# Run command in specific package
pnpm --filter <package-name> <command>

# Examples:
pnpm --filter agent-orchestrator-daemon run dev
pnpm --filter web run build
pnpm --filter @agent-orchestrator/shared run type-check
```

### Adding Dependencies
```bash
# Add to root (dev dependencies only)
pnpm add -D <package> -w

# Add to specific workspace package
pnpm --filter <package-name> add <dependency>

# Examples:
pnpm --filter web add lucide-react
pnpm --filter agent-orchestrator-daemon add uuid
```

### Shared Package Usage
Apps can reference the shared package:
```typescript
// In apps/daemon or apps/web
import { BaseConfig } from '@agent-orchestrator/shared';
```

## Next.js App Router Best Practices (apps/web)

### Critical Rule: Async Components Cannot Be Client Components
**NEVER** add `'use client'` to a file containing an async component. This will cause a runtime error.

### Server vs Client Component Guidelines

#### When to Use Server Components (default)
- Async components that fetch data
- Components that don't need interactivity
- Components accessing backend resources
- **DO NOT add `'use client'` to these files**

#### When to Use Client Components (`'use client'`)
Only add `'use client'` when you need:
- React hooks (useState, useEffect, useRef, useContext, etc.)
- Browser APIs (IntersectionObserver, localStorage, window, document, etc.)
- Event handlers (onClick, onChange, onSubmit, etc.)
- Third-party libraries that require client-side rendering

### Proper Architecture Pattern
When you need BOTH server-side data fetching AND client-side interactivity:

```tsx
// ✅ CORRECT: page.tsx (Server Component - NO 'use client')
import { ClientWrapper } from './client-wrapper';

async function getData() {
  // Server-side data fetching
  const data = await fetch(...);
  return data;
}

export default async function Page() {
  const data = await getData();
  return <ClientWrapper data={data} />;
}

// ✅ CORRECT: client-wrapper.tsx (Client Component)
'use client';
import { useState, useEffect } from 'react';

export function ClientWrapper({ data }) {
  const [state, setState] = useState(null);
  // Client-side interactivity here
  return <div>...</div>;
}
```

### Common Mistake to Avoid
```tsx
// ❌ WRONG: This will cause an error!
'use client';

export default async function Page() {  // ← Error: async in client component
  const data = await fetch(...);
  return <div>{data}</div>;
}
```

**Error message:** `async/await is not yet supported in Client Components`

### Solution Pattern
1. Keep page.tsx as Server Component (remove `'use client'`)
2. Extract client logic to separate component file
3. Server fetches data → passes to Client Component → handles interactivity

## Environment Variables & Server-Side Only Code

### Critical Rule: Separate Server-Only Modules
**PROBLEM:** Even Server Components get bundled into the client-side JavaScript, which means any module-level code runs on both server AND client.

**SOLUTION:** Keep server-only code (like admin clients with service role keys) in separate files that are ONLY imported by server-side code.

### The Core Issue
When you import a module in Next.js:
- ❌ Module-level code executes immediately when imported
- ❌ This happens even in Server Components during bundling
- ❌ If the module uses `process.env.SOME_SECRET`, it will try to access it on the client side too

### Example Problem
```tsx
// ❌ WRONG: lib/supabase.ts
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← Will try to access on client!
);

// page.tsx (Server Component)
import { supabaseAdmin } from '@/lib/supabase';  // ← Triggers client-side evaluation!
```

**Error:** `supabaseKey is required` - because `SUPABASE_SERVICE_ROLE_KEY` is not available on the client.

### Correct Solution: Separate Files
```tsx
// ✅ CORRECT: lib/supabase.ts (can be imported anywhere)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ✅ CORRECT: lib/supabase-admin.ts (ONLY import in server code)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← Safe, only evaluated server-side
);

// page.tsx (Server Component)
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';  // ← Only imports server-side
```

### Best Practices
1. **Separate server-only modules** - Keep admin clients, service role keys, and server-only logic in separate files
2. **Never use `NEXT_PUBLIC_` for secrets** - Only use it for truly public values
3. **Test imports** - If you get "X is required" errors for env vars, check if server-only code is being bundled
4. **File naming convention** - Use `-admin`, `-server`, or `-private` suffixes for server-only modules

### Environment Variable Naming
- `NEXT_PUBLIC_*` → Exposed to client (bundled in JavaScript)
- `SUPABASE_SERVICE_ROLE_KEY` → Server-only (never exposed)
- API routes can safely use any env var (always server-side)

## Database Migrations (Supabase)

### Critical Rule: Always Create Migration Files First
**NEVER** apply migrations directly using MCP tools without creating local migration files first.

### Migration Workflow
1. **Create migration file locally** in `supabase/migrations/`
   ```bash
   # Generate timestamped migration file
   npx supabase migration new <descriptive_name>
   ```

2. **Write the migration SQL** in the generated file
   - Include comments explaining the changes
   - Add rollback instructions if needed
   - Test queries locally when possible
   - **Check for recursive RLS issues** - Avoid policies that query tables with their own RLS

3. **Review the migration** before applying
   - Check for typos and syntax errors
   - Verify foreign key references
   - Ensure RLS policies are included
   - **IMPORTANT**: Analyze for potential recursive RLS (policies querying RLS-enabled tables)

4. **Apply the migration**
   ```bash
   # ALWAYS use Supabase MCP tools (preferred method)
   # Use mcp__supabase__apply_migration with the SQL from the file

   # NEVER use: npx supabase db push
   # The MCP tools provide better integration and error handling
   ```

5. **Verify the migration**
   - Check tables were created correctly
   - Test RLS policies don't cause recursion or blocking
   - Run security advisors with mcp__supabase__get_advisors

### Best Practices
- **One migration per logical change** - Don't bundle unrelated changes
- **Include rollback steps** - Add comments showing how to revert
- **Test migrations locally first** if possible
- **Never hardcode IDs** in migrations - use relationships instead
- **Always add RLS policies** for new tables to prevent security issues

### Migration File Naming Convention
Files are auto-generated with timestamps: `YYYYMMDDHHMMSS_descriptive_name.sql`

Example:
- `20251015033204_create_projects_table.sql`
- `20251015033311_create_project_shares_table.sql`

## Additional Notes
- Handling Cursor Messages in CURSOR_MESSAGES.md