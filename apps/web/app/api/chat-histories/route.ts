/**
 * API endpoint for fetching chat histories for extraction
 * GET /api/chat-histories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

    // Fetch chat histories (RLS will automatically filter by user)
    const { data: histories, error } = await supabase
      .from('chat_histories')
      .select('id, ai_title, ai_summary, messages, latest_message_timestamp, created_at')
      .order('latest_message_timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat histories:', error);
      return NextResponse.json({ error: 'Failed to fetch chat histories' }, { status: 500 });
    }

    return NextResponse.json({
      histories: histories || [],
      total: histories?.length || 0,
    });
  } catch (error) {
    console.error('Error in chat histories endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
