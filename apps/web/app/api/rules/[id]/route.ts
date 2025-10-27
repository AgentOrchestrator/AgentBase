/**
 * API endpoint for updating a rule
 * PATCH /api/rules/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { updateRule, getRuleById } from '@/lib/rules/rules-queries';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const rule = await getRuleById(params.id);
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error fetching rule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const { rule_text, rule_category } = body;

    if (!rule_text && !rule_category) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const updates: { rule_text?: string; rule_category?: string } = {};
    if (rule_text) updates.rule_text = rule_text;
    if (rule_category) updates.rule_category = rule_category;

    await updateRule(params.id, updates);

    return NextResponse.json({ success: true, rule_id: params.id });
  } catch (error) {
    console.error('Error updating rule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
