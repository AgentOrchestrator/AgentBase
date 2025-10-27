/**
 * Client-side wrapper for Rules API calls
 */

import type {
  RuleFilters,
  RulesResponse,
  ExtractionRequest,
  ExtractionResult,
  FileConfig,
  FileResult,
  ExtractionPrompt,
  RulesStats,
} from './types';

export class RulesClient {
  /**
   * Extract rules from chat histories
   */
  async extractRules(request: ExtractionRequest): Promise<ExtractionResult> {
    const response = await fetch('/api/rules/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract rules');
    }

    return response.json();
  }

  /**
   * Get rules with optional filtering
   */
  async getRules(filters: RuleFilters = {}): Promise<RulesResponse> {
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.workspace_id) params.append('workspace_id', filters.workspace_id);
    if (filters.project_id) params.append('project_id', filters.project_id);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`/api/rules?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch rules');
    }

    return response.json();
  }

  /**
   * Approve a rule
   */
  async approveRule(ruleId: string, notes?: string): Promise<void> {
    const response = await fetch(`/api/rules/${ruleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to approve rule');
    }
  }

  /**
   * Reject a rule
   */
  async rejectRule(ruleId: string, reason: string, notes?: string): Promise<void> {
    const response = await fetch(`/api/rules/${ruleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', reason, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject rule');
    }
  }

  /**
   * Update rule status
   */
  async updateRuleStatus(
    ruleId: string,
    status: string,
    reason?: string,
    notes?: string
  ): Promise<void> {
    const response = await fetch(`/api/rules/${ruleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason, notes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update rule status');
    }
  }

  /**
   * Edit a rule
   */
  async editRule(ruleId: string, updates: { rule_text?: string; rule_category?: string }): Promise<void> {
    const response = await fetch(`/api/rules/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to edit rule');
    }
  }

  /**
   * Generate rule file
   */
  async generateFile(config: FileConfig): Promise<FileResult> {
    const response = await fetch('/api/rules/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate file');
    }

    return response.json();
  }

  /**
   * Get extraction prompts
   */
  async getPrompts(): Promise<ExtractionPrompt[]> {
    const response = await fetch('/api/prompts');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch prompts');
    }

    const data = await response.json();
    return data.prompts;
  }

  /**
   * Create extraction prompt
   */
  async createPrompt(prompt: Omit<ExtractionPrompt, 'id' | 'created_at' | 'updated_at'>): Promise<ExtractionPrompt> {
    const response = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create prompt');
    }

    return response.json();
  }

  /**
   * Get rules statistics
   */
  async getStats(): Promise<RulesStats> {
    const response = await fetch('/api/rules/stats');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch stats');
    }

    return response.json();
  }
}

// Export singleton instance
export const rulesClient = new RulesClient();
