import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, pinned } = body;

    if (!conversationId || typeof pinned !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    if (pinned) {
      // Pin the conversation
      const { error } = await supabase
        .from('pinned_conversations')
        .upsert({
          user_id: user.id,
          conversation_id: conversationId,
        }, {
          onConflict: 'user_id,conversation_id'
        });

      if (error) {
        console.error('Error pinning conversation:', error);
        return NextResponse.json({ error: 'Failed to pin conversation' }, { status: 500 });
      }
    } else {
      // Unpin the conversation
      const { error } = await supabase
        .from('pinned_conversations')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId);

      if (error) {
        console.error('Error unpinning conversation:', error);
        return NextResponse.json({ error: 'Failed to unpin conversation' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, pinned });
  } catch (error) {
    console.error('Error in POST /api/canvas/pin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all pinned conversations for the user
    const { data: pinnedConversations, error } = await supabase
      .from('pinned_conversations')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching pinned conversations:', error);
      return NextResponse.json({ error: 'Failed to fetch pinned conversations' }, { status: 500 });
    }

    const pinnedIds = pinnedConversations?.map(pc => pc.conversation_id) || [];
    return NextResponse.json({ pinnedConversationIds: pinnedIds });
  } catch (error) {
    console.error('Error in GET /api/canvas/pin:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
