/**
 * API endpoint for previewing approved rules before generation
 * GET /api/rules/preview?workspace_id=xxx&project_id=yyy
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getApprovedRules } from '@/lib/rules/rules-queries';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspace_id');
    const projectId = searchParams.get('project_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Get approved rules
    const rules = await getApprovedRules(workspaceId, projectId || undefined);

    if (!rules || rules.length === 0) {
      return NextResponse.json({
        rules: [],
        total: 0,
        by_category: {},
        message: 'No approved rules found for this workspace/project',
      });
    }

    // Group by category for better preview
    const byCategory = rules.reduce((acc: any, rule) => {
      const category = rule.rule_category || 'uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: rule.id,
        text: rule.rule_text,
        confidence: rule.confidence_score,
      });
      return acc;
    }, {});

    return NextResponse.json({
      rules: rules.map(r => ({
        id: r.id,
        text: r.rule_text,
        category: r.rule_category,
        confidence: r.confidence_score,
      })),
      total: rules.length,
      by_category: byCategory,
    });
  } catch (error) {
    console.error('Error previewing rules:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
