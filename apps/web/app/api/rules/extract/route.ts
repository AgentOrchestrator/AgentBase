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
      .select('id, messages')
      .in('id', chat_history_ids);

    if (chatError) {
      console.error('Database error fetching chat histories:', chatError);
      return NextResponse.json({ error: `Failed to fetch chat histories: ${chatError.message}` }, { status: 500 });
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
    console.log(`Calling memory service at ${memoryServiceUrl}/extract-rules`);
    console.log(`Extracting rules from ${chat_history_ids.length} chat histories for user ${user.id}`);

    const response = await fetch(`${memoryServiceUrl}/extract-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_history_ids: chat_history_ids,  // Memory service fetches from DB
        user_id: user.id,
        prompt_id: prompt_id || null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Memory service error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown error' };
      }

      return NextResponse.json(
        { error: `Memory service error: ${errorData.error || errorData.detail || response.statusText}` },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      rules_extracted: result.rules_count || 0,
      pending_review: result.rules_count || 0, // All extracted rules go to pending
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
