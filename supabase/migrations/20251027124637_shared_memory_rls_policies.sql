-- Row Level Security (RLS) Policies for Shared Memory System
-- Ensures users can only access rules from their workspaces/projects

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE extracted_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_file_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- EXTRACTED RULES POLICIES
-- ============================================================================

-- Policy: Users can view rules from their workspaces or projects they have access to
CREATE POLICY "Users can view rules from their workspaces"
  ON extracted_rules
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Rules in user's workspace
      workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
      )
      -- OR rules in user's projects
      OR project_id IN (
        SELECT id
        FROM projects
        WHERE user_id = auth.uid()
      )
      -- OR rules created by user (no workspace/project assigned)
      OR (extracted_by = auth.uid() AND workspace_id IS NULL AND project_id IS NULL)
      -- OR global rules (no workspace/project)
      OR (workspace_id IS NULL AND project_id IS NULL)
    )
  );

-- Policy: Users can insert rules for their workspaces/projects
CREATE POLICY "Users can create rules for their workspaces"
  ON extracted_rules
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Can create for own workspace
      workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
      )
      -- OR for own projects
      OR project_id IN (
        SELECT id
        FROM projects
        WHERE user_id = auth.uid()
      )
      -- OR personal rules (no workspace/project)
      OR (workspace_id IS NULL AND project_id IS NULL AND extracted_by = auth.uid())
    )
  );

-- Policy: Users can update their own rules or workspace rules if they're admins
CREATE POLICY "Users can update their own rules or workspace rules"
  ON extracted_rules
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Own rules
      extracted_by = auth.uid()
      -- OR workspace admin
      OR workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
          AND (w.created_by_user_id = auth.uid() OR wm.role = 'admin')
      )
    )
  );

-- Policy: Users can delete their own rules or workspace admins can delete workspace rules
CREATE POLICY "Users can delete their own rules or workspace rules"
  ON extracted_rules
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Own rules
      extracted_by = auth.uid()
      -- OR workspace admin
      OR workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
          AND (w.created_by_user_id = auth.uid() OR wm.role = 'admin')
      )
    )
  );

-- ============================================================================
-- RULE APPROVALS POLICIES
-- ============================================================================

-- Policy: Users can view approvals for rules they can see
CREATE POLICY "Users can view approvals for accessible rules"
  ON rule_approvals
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND rule_id IN (
      SELECT id FROM extracted_rules
      -- Will use extracted_rules RLS policies
    )
  );

-- Policy: Users can insert approvals when creating rules
CREATE POLICY "Users can create approvals for new rules"
  ON rule_approvals
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND rule_id IN (
      SELECT id FROM extracted_rules
      WHERE extracted_by = auth.uid()
    )
  );

-- Policy: Workspace members can update approval status
CREATE POLICY "Workspace members can update approval status"
  ON rule_approvals
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND rule_id IN (
      SELECT r.id
      FROM extracted_rules r
      WHERE
        -- User is in the workspace
        r.workspace_id IN (
          SELECT workspace_id
          FROM workspace_members
          WHERE user_id = auth.uid()
        )
        -- OR it's user's own project
        OR r.project_id IN (
          SELECT id FROM projects WHERE user_id = auth.uid()
        )
        -- OR user created it
        OR r.extracted_by = auth.uid()
    )
  );

-- ============================================================================
-- RULE APPROVAL HISTORY POLICIES
-- ============================================================================

-- Policy: Users can view history for rules they can access
CREATE POLICY "Users can view approval history for accessible rules"
  ON rule_approval_history
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND rule_id IN (
      SELECT id FROM extracted_rules
      -- Will use extracted_rules RLS policies
    )
  );

-- Policy: System can insert history (via helper functions)
CREATE POLICY "System can insert approval history"
  ON rule_approval_history
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND changed_by = auth.uid()
  );

-- ============================================================================
-- EXTRACTION PROMPTS POLICIES
-- ============================================================================

-- Policy: All authenticated users can view global prompts
CREATE POLICY "Users can view global and workspace prompts"
  ON extraction_prompts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Global prompts (no workspace)
      workspace_id IS NULL
      -- OR prompts from user's workspaces
      OR workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Workspace admins can create workspace-specific prompts
CREATE POLICY "Workspace admins can create prompts"
  ON extraction_prompts
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Global prompts: only if user is system admin (check users table)
      (workspace_id IS NULL AND auth.uid() IN (
        SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_admin' = 'true'
      ))
      -- OR workspace-specific: user is workspace admin
      OR workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
          AND (w.created_by_user_id = auth.uid() OR wm.role = 'admin')
      )
    )
  );

-- Policy: Workspace admins can update their prompts
CREATE POLICY "Workspace admins can update prompts"
  ON extraction_prompts
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Global prompts: system admin only
      (workspace_id IS NULL AND auth.uid() IN (
        SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_admin' = 'true'
      ))
      -- OR workspace admin
      OR workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
          AND (w.created_by_user_id = auth.uid() OR wm.role = 'admin')
      )
      -- OR creator
      OR created_by = auth.uid()
    )
  );

-- Policy: Creators and workspace admins can delete prompts
CREATE POLICY "Creators and admins can delete prompts"
  ON extraction_prompts
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      created_by = auth.uid()
      OR workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
          AND (w.created_by_user_id = auth.uid() OR wm.role = 'admin')
      )
    )
  );

-- ============================================================================
-- RULE FILE CONFIGS POLICIES
-- ============================================================================

-- Policy: Users can view configs for their workspaces/projects
CREATE POLICY "Users can view file configs for their workspaces"
  ON rule_file_configs
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
      )
      OR project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Workspace members can create file configs
CREATE POLICY "Workspace members can create file configs"
  ON rule_file_configs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
      )
      OR project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Workspace admins can update file configs
CREATE POLICY "Workspace admins can update file configs"
  ON rule_file_configs
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
          AND (w.created_by_user_id = auth.uid() OR wm.role = 'admin')
      )
      OR project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Workspace admins can delete file configs
CREATE POLICY "Workspace admins can delete file configs"
  ON rule_file_configs
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        INNER JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = auth.uid()
          AND (w.created_by_user_id = auth.uid() OR wm.role = 'admin')
      )
      OR project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS ON HELPER FUNCTIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_approved_rules TO authenticated;
GRANT EXECUTE ON FUNCTION approve_rule TO authenticated;
GRANT EXECUTE ON FUNCTION reject_rule TO authenticated;
