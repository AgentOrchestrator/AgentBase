/**
 * Shared types for the Rules/Shared Memory system
 */

export type RuleStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision' | 'archived';

export type RuleCategory =
  | 'git-workflow'
  | 'code-style'
  | 'architecture'
  | 'best-practices'
  | 'testing'
  | 'documentation';

export interface Rule {
  id: string;
  rule_text: string;
  rule_category: RuleCategory;
  confidence_score: number;
  source_session_ids: string[];
  workspace_id?: string;
  project_id?: string;
  created_at: string;
  updated_at?: string;
  extracted_by?: string;
}

export interface RuleApproval {
  rule_id: string;
  status: RuleStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  notes?: string;
}

export interface RuleWithApproval extends Rule {
  approval: RuleApproval;
}

export interface RuleFilters {
  status?: RuleStatus;
  category?: RuleCategory;
  workspace_id?: string;
  project_id?: string;
  limit?: number;
  offset?: number;
}

export interface RulesResponse {
  rules: RuleWithApproval[];
  total: number;
  page: number;
}

export interface ExtractionRequest {
  chat_history_ids: string[];
  workspace_id?: string;
  prompt_id?: string;
}

export interface ExtractionResult {
  success: boolean;
  rules_extracted: number;
  pending_review: number;
  job_id?: string;
}

export interface FileConfig {
  workspace_id: string;
  project_id?: string;
  file_type: 'cursorrules' | 'claude_md';
  preview_only?: boolean;
}

export interface FileResult {
  success: boolean;
  file_content: string;
  file_path: string;
  rules_included: number;
  download_url?: string;
}

export interface ExtractionPrompt {
  id: string;
  name: string;
  description: string;
  prompt_text: string;
  is_active: boolean;
  target_categories: RuleCategory[];
  min_confidence: number;
  workspace_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface RulesStats {
  pending: number;
  approved: number;
  rejected: number;
  recent_extractions: Array<{
    timestamp: string;
    rules_count: number;
    user: string;
  }>;
}
