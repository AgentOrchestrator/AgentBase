-- Shared Memory System: Extract and manage coding rules from chat histories
-- Uses mem0 for intelligent processing of long conversations
-- Separate approval workflow table for extensible authorization

-- ============================================================================
-- 1. EXTRACTED RULES TABLE (Core rule data)
-- ============================================================================
CREATE TABLE extracted_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rule content
  rule_text TEXT NOT NULL,
  rule_category TEXT, -- 'git-workflow', 'code-style', 'architecture', 'best-practices', etc.

  -- Source tracking
  source_session_ids UUID[] NOT NULL, -- Array of chat_history IDs that contributed to this rule
  mem0_memory_id TEXT, -- Reference to mem0 memory entry for traceability
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1), -- 0-1 confidence from LLM

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Organization
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  extracted_by UUID REFERENCES auth.users(id), -- Who triggered the extraction

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_extracted_rules_workspace ON extracted_rules(workspace_id);
CREATE INDEX idx_extracted_rules_project ON extracted_rules(project_id);
CREATE INDEX idx_extracted_rules_category ON extracted_rules(rule_category);
CREATE INDEX idx_extracted_rules_confidence ON extracted_rules(confidence_score);
CREATE INDEX idx_extracted_rules_created_at ON extracted_rules(created_at DESC);

-- Updated timestamp trigger
CREATE TRIGGER update_extracted_rules_updated_at
  BEFORE UPDATE ON extracted_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE extracted_rules IS 'Stores coding rules extracted from chat histories using mem0';
COMMENT ON COLUMN extracted_rules.source_session_ids IS 'Array of chat_history IDs that provided evidence for this rule';
COMMENT ON COLUMN extracted_rules.mem0_memory_id IS 'Reference to mem0 memory entry for full context';
COMMENT ON COLUMN extracted_rules.confidence_score IS 'LLM confidence score (0-1) for rule validity';

-- ============================================================================
-- 2. RULE APPROVALS TABLE (Separate, extensible approval workflow)
-- ============================================================================
CREATE TABLE rule_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to rule
  rule_id UUID NOT NULL REFERENCES extracted_rules(id) ON DELETE CASCADE,

  -- Approval state (flexible, extensible statuses)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'needs_revision', 'archived', 'under_review', 'escalated')
  ),

  -- Approval details
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  revision_notes TEXT,

  -- Multi-step approval support (future extensibility)
  required_approvals INTEGER DEFAULT 1 CHECK (required_approvals > 0),
  current_approvals INTEGER DEFAULT 0 CHECK (current_approvals >= 0),

  -- Role-based approval (future extensibility)
  required_role TEXT, -- 'admin', 'maintainer', 'any'

  -- Conditional auto-approval (future extensibility)
  auto_approved BOOLEAN DEFAULT FALSE,
  approval_conditions JSONB, -- Store custom approval logic

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One approval record per rule
  UNIQUE(rule_id)
);

-- Indexes for approval queries
CREATE INDEX idx_rule_approvals_status ON rule_approvals(status);
CREATE INDEX idx_rule_approvals_rule_id ON rule_approvals(rule_id);
CREATE INDEX idx_rule_approvals_reviewed_by ON rule_approvals(reviewed_by);
CREATE INDEX idx_rule_approvals_pending ON rule_approvals(status) WHERE status = 'pending';

-- Updated timestamp trigger
CREATE TRIGGER update_rule_approvals_updated_at
  BEFORE UPDATE ON rule_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE rule_approvals IS 'Approval workflow for extracted rules (separated for extensibility)';
COMMENT ON COLUMN rule_approvals.required_approvals IS 'Number of approvals needed (for multi-step approval)';
COMMENT ON COLUMN rule_approvals.approval_conditions IS 'JSONB field for custom conditional approval logic';

-- ============================================================================
-- 3. RULE APPROVAL HISTORY TABLE (Audit log)
-- ============================================================================
CREATE TABLE rule_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_id UUID NOT NULL REFERENCES extracted_rules(id) ON DELETE CASCADE,

  -- State change tracking
  previous_status TEXT,
  new_status TEXT NOT NULL,

  -- Who made the change
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  change_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX idx_rule_approval_history_rule ON rule_approval_history(rule_id, created_at DESC);
CREATE INDEX idx_rule_approval_history_changed_by ON rule_approval_history(changed_by);

COMMENT ON TABLE rule_approval_history IS 'Audit trail for all rule approval status changes';

-- ============================================================================
-- 4. EXTRACTION PROMPTS TABLE (Database-stored, modular prompts)
-- ============================================================================
CREATE TABLE extraction_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Prompt details
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  -- Configuration
  target_categories TEXT[], -- Which categories this prompt extracts
  min_confidence FLOAT DEFAULT 0.7 CHECK (min_confidence >= 0 AND min_confidence <= 1),

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = global prompt

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique name per workspace (NULL workspace = global)
  UNIQUE NULLS NOT DISTINCT (name, workspace_id)
);

-- Indexes
CREATE INDEX idx_extraction_prompts_active ON extraction_prompts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_extraction_prompts_workspace ON extraction_prompts(workspace_id);
CREATE INDEX idx_extraction_prompts_name ON extraction_prompts(name);

-- Updated timestamp trigger
CREATE TRIGGER update_extraction_prompts_updated_at
  BEFORE UPDATE ON extraction_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE extraction_prompts IS 'Modular prompts for rule extraction (stored in DB for easy modification)';
COMMENT ON COLUMN extraction_prompts.workspace_id IS 'NULL for global prompts, workspace ID for workspace-specific';

-- ============================================================================
-- 5. RULE FILE CONFIGS TABLE (Track generated rule files)
-- ============================================================================
CREATE TABLE rule_file_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File details
  file_path TEXT NOT NULL, -- '.cursorrules', 'CLAUDE.md', etc.
  file_type TEXT NOT NULL CHECK (file_type IN ('cursorrules', 'claude_md', 'custom')),

  -- Generation tracking
  last_generated_at TIMESTAMPTZ,
  last_generated_by UUID REFERENCES auth.users(id),
  last_generated_content TEXT, -- Store last generated content for diff

  -- Organization
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Automation settings
  auto_sync_enabled BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique file per workspace/project
  UNIQUE NULLS NOT DISTINCT (file_path, workspace_id, project_id)
);

-- Indexes
CREATE INDEX idx_rule_file_configs_workspace ON rule_file_configs(workspace_id);
CREATE INDEX idx_rule_file_configs_project ON rule_file_configs(project_id);
CREATE INDEX idx_rule_file_configs_auto_sync ON rule_file_configs(auto_sync_enabled) WHERE auto_sync_enabled = TRUE;

-- Updated timestamp trigger
CREATE TRIGGER update_rule_file_configs_updated_at
  BEFORE UPDATE ON rule_file_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE rule_file_configs IS 'Configuration and tracking for generated rule files';
COMMENT ON COLUMN rule_file_configs.last_generated_content IS 'Stored for diff generation';

-- ============================================================================
-- SEED DATA: Default Extraction Prompt
-- ============================================================================
INSERT INTO extraction_prompts (name, description, prompt_text, target_categories, is_active)
VALUES (
  'default',
  'General-purpose prompt for extracting coding rules from conversations',
  $$Analyze the following conversation between a developer and an AI coding assistant.

Extract actionable coding rules that should be remembered for future sessions. Focus on:

1. **Repeated Corrections:** Patterns where the developer corrects the AI multiple times (e.g., "use X instead of Y", "always do Z before W")
2. **Workflow Preferences:** Steps the developer explicitly wants followed (e.g., "always create migration files first", "test locally before pushing")
3. **Technical Constraints:** Architecture decisions, technology choices, or technical limitations (e.g., "never use 'use client' with async", "must use pnpm not npm")
4. **Style Preferences:** Code formatting, naming conventions, file organization (e.g., "prefer functional components", "use kebab-case for file names")

For each rule you extract, provide:
- **rule_text**: Clear, actionable statement starting with a verb (e.g., "Use pnpm for all package management")
- **category**: One of: git-workflow, code-style, architecture, best-practices, testing, documentation
- **confidence**: Score from 0-1 based on:
  - 0.9-1.0: Explicitly stated by user multiple times
  - 0.7-0.9: Clearly implied or stated once emphatically
  - 0.5-0.7: Inferred from context
  - Below 0.5: Don't include
- **evidence**: Brief quote from conversation showing where this rule came from

Return JSON array format:
[
  {
    "rule_text": "Always create migration files before applying database changes",
    "category": "best-practices",
    "confidence": 0.95,
    "evidence": "User said: 'NEVER apply migrations directly without creating local migration files first'"
  }
]

Conversation:
{conversation_text}

Context from similar sessions (via mem0):
{mem0_context}

Extract only high-quality, actionable rules. When in doubt, err on the side of caution.$$,
  ARRAY['git-workflow', 'code-style', 'architecture', 'best-practices', 'testing', 'documentation'],
  TRUE
);

COMMENT ON TABLE extraction_prompts IS 'Seeded with default prompt for rule extraction';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get approved rules for a workspace/project
CREATE OR REPLACE FUNCTION get_approved_rules(
  p_workspace_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  rule_text TEXT,
  rule_category TEXT,
  confidence_score FLOAT,
  usage_count INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.rule_text,
    r.rule_category,
    r.confidence_score,
    r.usage_count,
    r.created_at
  FROM extracted_rules r
  INNER JOIN rule_approvals ra ON r.id = ra.rule_id
  WHERE ra.status = 'approved'
    AND (p_workspace_id IS NULL OR r.workspace_id = p_workspace_id)
    AND (p_project_id IS NULL OR r.project_id = p_project_id)
    AND (p_category IS NULL OR r.rule_category = p_category)
  ORDER BY r.rule_category, r.confidence_score DESC, r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_approved_rules IS 'Get all approved rules filtered by workspace/project/category';

-- Function: Approve a rule (with history tracking)
CREATE OR REPLACE FUNCTION approve_rule(
  p_rule_id UUID,
  p_reviewed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_previous_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_previous_status
  FROM rule_approvals
  WHERE rule_id = p_rule_id;

  -- Update approval status
  UPDATE rule_approvals
  SET
    status = 'approved',
    reviewed_by = p_reviewed_by,
    reviewed_at = NOW(),
    revision_notes = p_notes,
    updated_at = NOW()
  WHERE rule_id = p_rule_id;

  -- Log to history
  INSERT INTO rule_approval_history (rule_id, previous_status, new_status, changed_by, change_reason)
  VALUES (p_rule_id, v_previous_status, 'approved', p_reviewed_by, p_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION approve_rule IS 'Approve a rule and log the change to history';

-- Function: Reject a rule (with history tracking)
CREATE OR REPLACE FUNCTION reject_rule(
  p_rule_id UUID,
  p_reviewed_by UUID,
  p_rejection_reason TEXT
)
RETURNS VOID AS $$
DECLARE
  v_previous_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_previous_status
  FROM rule_approvals
  WHERE rule_id = p_rule_id;

  -- Update approval status
  UPDATE rule_approvals
  SET
    status = 'rejected',
    reviewed_by = p_reviewed_by,
    reviewed_at = NOW(),
    rejection_reason = p_rejection_reason,
    updated_at = NOW()
  WHERE rule_id = p_rule_id;

  -- Log to history
  INSERT INTO rule_approval_history (rule_id, previous_status, new_status, changed_by, change_reason)
  VALUES (p_rule_id, v_previous_status, 'rejected', p_reviewed_by, p_rejection_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reject_rule IS 'Reject a rule and log the change to history';
