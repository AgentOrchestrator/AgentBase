/**
 * Database query helpers for rules
 * These are server-side only functions
 */

import { createClient } from '@/lib/supabase-server';
import type { RuleFilters, RuleWithApproval, RulesStats } from './types';

/**
 * Get rules with optional filtering
 */
export async function getRules(filters: RuleFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from('extracted_rules')
    .select(
      `
      *,
      rule_approvals (
        rule_id,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        notes
      )
    `,
      { count: 'exact' }
    );

  // Apply filters
  if (filters.status) {
    query = query.eq('rule_approvals.status', filters.status);
  }

  if (filters.category) {
    query = query.eq('rule_category', filters.category);
  }

  if (filters.workspace_id) {
    query = query.eq('workspace_id', filters.workspace_id);
  }

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id);
  }

  // Sorting
  query = query.order('confidence_score', { ascending: false }).order('created_at', { ascending: false });

  // Pagination
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch rules: ${error.message}`);
  }

  // Transform data to include approval as nested object
  const rules: RuleWithApproval[] =
    data?.map((rule: any) => ({
      ...rule,
      approval: Array.isArray(rule.rule_approvals) ? rule.rule_approvals[0] : rule.rule_approvals,
    })) || [];

  return {
    rules,
    total: count || 0,
    page: Math.floor(offset / limit),
  };
}

/**
 * Get a single rule by ID
 */
export async function getRuleById(ruleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('extracted_rules')
    .select(
      `
      *,
      rule_approvals (
        rule_id,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        notes
      )
    `
    )
    .eq('id', ruleId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch rule: ${error.message}`);
  }

  return {
    ...data,
    approval: Array.isArray(data.rule_approvals) ? data.rule_approvals[0] : data.rule_approvals,
  } as RuleWithApproval;
}

/**
 * Approve a rule (uses helper function)
 */
export async function approveRule(ruleId: string, userId: string, notes?: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('approve_rule', {
    p_rule_id: ruleId,
    p_reviewed_by: userId,
    p_notes: notes || null,
  });

  if (error) {
    throw new Error(`Failed to approve rule: ${error.message}`);
  }

  return data;
}

/**
 * Reject a rule (uses helper function)
 */
export async function rejectRule(ruleId: string, userId: string, reason: string, notes?: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('reject_rule', {
    p_rule_id: ruleId,
    p_reviewed_by: userId,
    p_reason: reason,
    p_notes: notes || null,
  });

  if (error) {
    throw new Error(`Failed to reject rule: ${error.message}`);
  }

  return data;
}

/**
 * Update rule status
 */
export async function updateRuleStatus(
  ruleId: string,
  userId: string,
  status: string,
  reason?: string,
  notes?: string
) {
  const supabase = await createClient();

  // First update the rule_approvals table
  const { error } = await supabase
    .from('rule_approvals')
    .update({
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
      notes: notes || null,
    })
    .eq('rule_id', ruleId);

  if (error) {
    throw new Error(`Failed to update rule status: ${error.message}`);
  }

  // Create history entry
  const { error: historyError } = await supabase.from('rule_approval_history').insert({
    rule_id: ruleId,
    previous_status: status, // We'd need to fetch previous status first
    new_status: status,
    changed_by: userId,
    reason: reason || null,
  });

  if (historyError) {
    console.error('Failed to create history entry:', historyError);
    // Don't throw, history is optional
  }
}

/**
 * Update rule text or category
 */
export async function updateRule(ruleId: string, updates: { rule_text?: string; rule_category?: string }) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('extracted_rules')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId);

  if (error) {
    throw new Error(`Failed to update rule: ${error.message}`);
  }
}

/**
 * Get approved rules for file generation
 */
export async function getApprovedRules(workspaceId?: string, projectId?: string) {
  const supabase = await createClient();

  // Use the get_approved_rules helper function
  const { data, error } = await supabase.rpc('get_approved_rules', {
    p_workspace_id: workspaceId || null,
    p_project_id: projectId || null,
  });

  if (error) {
    throw new Error(`Failed to fetch approved rules: ${error.message}`);
  }

  return data || [];
}

/**
 * Get rules statistics
 */
export async function getRulesStats(): Promise<RulesStats> {
  const supabase = await createClient();

  // Get counts by status
  const { data: statusCounts, error: statusError } = await supabase
    .from('rule_approvals')
    .select('status, count')
    .eq('status', 'pending')
    .single();

  const { data: approvedCount, error: approvedError } = await supabase
    .from('rule_approvals')
    .select('status', { count: 'exact', head: true })
    .eq('status', 'approved');

  const { data: rejectedCount, error: rejectedError } = await supabase
    .from('rule_approvals')
    .select('status', { count: 'exact', head: true })
    .eq('status', 'rejected');

  // Get recent extractions (last 10)
  const { data: recentRules, error: recentError } = await supabase
    .from('extracted_rules')
    .select('created_at, extracted_by')
    .order('created_at', { ascending: false })
    .limit(100);

  // Group by date and user
  const extractionMap = new Map<string, { timestamp: string; rules_count: number; user: string }>();

  if (recentRules) {
    for (const rule of recentRules) {
      const date = new Date(rule.created_at).toISOString().split('T')[0];
      const key = `${date}-${rule.extracted_by || 'system'}`;

      if (!extractionMap.has(key)) {
        extractionMap.set(key, {
          timestamp: rule.created_at,
          rules_count: 1,
          user: rule.extracted_by || 'system',
        });
      } else {
        const entry = extractionMap.get(key)!;
        entry.rules_count++;
      }
    }
  }

  const recent_extractions = Array.from(extractionMap.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  return {
    pending: statusCounts?.count || 0,
    approved: approvedCount?.length || 0,
    rejected: rejectedCount?.length || 0,
    recent_extractions,
  };
}
