-- Seed script for testing Phase 2A of Shared Memory UI
-- This creates sample extracted rules and approvals for testing

-- First, let's get the current user ID (you'll need to replace this with your actual user ID)
-- You can find your user ID by running: SELECT id, email FROM auth.users;

-- For now, we'll use a placeholder - replace 'YOUR_USER_ID_HERE' with your actual user ID

-- Insert sample extracted rules
INSERT INTO public.extracted_rules (
  id,
  rule_text,
  rule_category,
  confidence_score,
  source_session_ids,
  workspace_id,
  extracted_by
) VALUES
  (
    gen_random_uuid(),
    'Always create a new branch for any code edits or features. Never push directly to main branch.',
    'git-workflow',
    0.95,
    ARRAY['session-1', 'session-2']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Use pnpm for all package management operations in the monorepo. Run pnpm install from the root to install all dependencies.',
    'best-practices',
    0.88,
    ARRAY['session-3']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Never add use client directive to async components. This will cause a runtime error in Next.js.',
    'architecture',
    0.92,
    ARRAY['session-4', 'session-5']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Keep server-only code like admin clients with service role keys in separate files that are only imported by server-side code.',
    'architecture',
    0.85,
    ARRAY['session-6']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Always create migration files locally in supabase/migrations/ before applying. Never apply migrations directly without creating local files first.',
    'best-practices',
    0.90,
    ARRAY['session-7', 'session-8']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Use TypeScript strict mode and ensure all types are properly defined. Run type-check before merging branches.',
    'code-style',
    0.78,
    ARRAY['session-9']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Write unit tests for all utility functions and integration tests for API endpoints.',
    'testing',
    0.82,
    ARRAY['session-10']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Document all public APIs with JSDoc comments including parameter types and return values.',
    'documentation',
    0.75,
    ARRAY['session-11']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Follow existing code conventions in the repository. Use consistent indentation and naming patterns.',
    'code-style',
    0.65,
    ARRAY['session-12']::uuid[],
    NULL,
    NULL
  ),
  (
    gen_random_uuid(),
    'Use React Server Components by default. Only add use client when you need interactivity, hooks, or browser APIs.',
    'architecture',
    0.93,
    ARRAY['session-13', 'session-14']::uuid[],
    NULL,
    NULL
  );

-- Note: The rule_approvals records will be automatically created by the trigger
-- with status 'pending' for all new rules

-- To view the results:
-- SELECT r.id, r.rule_text, r.rule_category, r.confidence_score, ra.status
-- FROM extracted_rules r
-- JOIN rule_approvals ra ON ra.rule_id = r.id
-- ORDER BY r.created_at DESC;

COMMIT;
