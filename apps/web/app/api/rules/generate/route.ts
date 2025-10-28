/**
 * API endpoint for generating and downloading rule files
 * POST /api/rules/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getRules } from '@/lib/rules/rules-queries';
import { generateCursorRules } from '@/lib/rules/templates/cursorrules';
import { generateClaudeMd } from '@/lib/rules/templates/claude-md';
import type { RuleWithApproval } from '@/lib/rules/types';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { file_type } = await request.json();

    if (!file_type || !['cursorrules', 'claude_md', 'text', 'all'].includes(file_type)) {
      return NextResponse.json({ error: 'Invalid file_type' }, { status: 400 });
    }

    // Get all approved rules
    const result = await getRules({ status: 'approved', limit: 1000 });
    const rulesWithApproval = result.rules;

    if (!rulesWithApproval || rulesWithApproval.length === 0) {
      return NextResponse.json({ error: 'No approved rules found' }, { status: 404 });
    }

    // Convert RuleWithApproval[] to Rule[] for template functions
    const rules = rulesWithApproval.map((rule: RuleWithApproval) => ({
      id: rule.id,
      rule_text: rule.rule_text,
      rule_category: rule.rule_category,
      confidence_score: rule.confidence_score,
      source_session_ids: rule.source_session_ids,
      workspace_id: rule.workspace_id,
      project_id: rule.project_id,
      created_at: rule.created_at,
      updated_at: rule.updated_at,
      extracted_by: rule.extracted_by,
    }));

    // Generate file content
    let fileContent: string;

    if (file_type === 'cursorrules') {
      fileContent = generateCursorRules(rules);
    } else if (file_type === 'claude_md') {
      fileContent = generateClaudeMd(rules);
    } else if (file_type === 'all') {
      // Combine all formats
      const cursorRulesContent = generateCursorRules(rules);
      const claudeMdContent = generateClaudeMd(rules);
      const textContent = rules.map(rule => `- ${rule.rule_text}`).join('\n');
      fileContent = `# Cursor Rules (.cursorrules)\n\n${cursorRulesContent}\n\n---\n\n# Claude MD (CLAUDE.md)\n\n${claudeMdContent}\n\n---\n\n# Text Format\n\n${textContent}`;
    } else {
      // Plain text format
      fileContent = rules.map(rule => `- ${rule.rule_text}`).join('\n');
    }

    return NextResponse.json({
      success: true,
      file_content: fileContent,
      rules_included: rules.length,
    });
  } catch (error) {
    console.error('Error generating rule file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

