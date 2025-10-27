/**
 * API endpoint for extracting rules from chat histories
 * POST /api/rules/extract
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { ExtractionRequest } from '@/lib/rules/types';

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
    const body: ExtractionRequest = await request.json();
    const { chat_history_ids, workspace_id, prompt_id } = body;

    if (!chat_history_ids || chat_history_ids.length === 0) {
      return NextResponse.json({ error: 'No chat histories provided' }, { status: 400 });
    }

    // Verify user has access to the chat histories
    const { data: chatHistories, error: chatError } = await supabase
      .from('chat_histories')
      .select('id, session_data')
      .in('id', chat_history_ids);

    if (chatError) {
      return NextResponse.json({ error: 'Failed to fetch chat histories' }, { status: 500 });
    }

    if (!chatHistories || chatHistories.length === 0) {
      return NextResponse.json({ error: 'No accessible chat histories found' }, { status: 404 });
    }

    // Get the prompt if specified
    let promptText = null;
    if (prompt_id) {
      const { data: prompt, error: promptError } = await supabase
        .from('extraction_prompts')
        .select('prompt_text')
        .eq('id', prompt_id)
        .single();

      if (!promptError && prompt) {
        promptText = prompt.prompt_text;
      }
    }

    // Call Python memory service
    const memoryServiceUrl = process.env.MEMORY_SERVICE_URL || 'http://localhost:8000';
    const response = await fetch(`${memoryServiceUrl}/extract-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_histories: chatHistories.map((ch) => ({
          id: ch.id,
          session_data: ch.session_data,
        })),
        workspace_id: workspace_id || null,
        prompt_text: promptText,
        user_id: user.id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { error: `Memory service error: ${errorData.error || response.statusText}` },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      rules_extracted: result.rules_extracted || 0,
      pending_review: result.pending_review || 0,
      job_id: result.job_id || null,
    });
  } catch (error) {
    console.error('Error extracting rules:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
