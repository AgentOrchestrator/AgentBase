/**
 * API endpoint for listing rules
 * GET /api/rules?status=pending&category=code-style&workspace_id=xxx&limit=50&offset=0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getRules } from '@/lib/rules/rules-queries';
import type { RuleFilters } from '@/lib/rules/types';

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters: RuleFilters = {
      status: (searchParams.get('status') as any) || undefined,
      category: (searchParams.get('category') as any) || undefined,
      workspace_id: searchParams.get('workspace_id') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // Fetch rules using helper
    const result = await getRules(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching rules:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
