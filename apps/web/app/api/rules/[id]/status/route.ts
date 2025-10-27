/**
 * API endpoint for updating rule approval status
 * PATCH /api/rules/:id/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { approveRule, rejectRule, updateRuleStatus } from '@/lib/rules/rules-queries';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
    const body = await request.json();
    const { status, reason, notes } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const validStatuses = ['approved', 'rejected', 'needs_revision', 'archived', 'pending'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Use helper functions for approve/reject
    if (status === 'approved') {
      await approveRule(params.id, user.id, notes);
    } else if (status === 'rejected') {
      if (!reason) {
        return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
      }
      await rejectRule(params.id, user.id, reason, notes);
    } else {
      // For other statuses, use generic update
      await updateRuleStatus(params.id, user.id, status, reason, notes);
    }

    return NextResponse.json({
      success: true,
      rule_id: params.id,
      new_status: status,
    });
  } catch (error) {
    console.error('Error updating rule status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
