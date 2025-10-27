/**
 * API endpoint for managing extraction prompts
 * GET /api/prompts - List prompts
 * POST /api/prompts - Create new prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

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

    // Fetch prompts (global or workspace-specific)
    const { data: prompts, error } = await supabase
      .from('extraction_prompts')
      .select('*')
      .or('workspace_id.is.null,workspace_id.eq.' + user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
    }

    return NextResponse.json({ prompts: prompts || [] });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const { name, description, prompt_text, target_categories, min_confidence, workspace_id, is_active = true } = body;

    // Validate required fields
    if (!name || !prompt_text) {
      return NextResponse.json({ error: 'name and prompt_text are required' }, { status: 400 });
    }

    // Create prompt
    const { data: prompt, error } = await supabase
      .from('extraction_prompts')
      .insert({
        name,
        description: description || null,
        prompt_text,
        target_categories: target_categories || [],
        min_confidence: min_confidence || 0.5,
        workspace_id: workspace_id || null,
        is_active,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 });
    }

    return NextResponse.json(prompt);
  } catch (error) {
    console.error('Error creating prompt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
