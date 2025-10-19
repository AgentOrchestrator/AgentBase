import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * Get paginated conversations for a specific user.
 * RLS policies ensure users can only access:
 * - Their own conversations
 * - Conversations from projects shared with them
 * - Conversations from projects shared with their workspaces
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '15');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Build query with RLS enforcement (will automatically filter based on user's access)
    let query = supabase
      .from('chat_histories')
      .select('*', { count: 'exact' })
      .eq('account_id', userId)
      .order('latest_message_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: conversations, count: totalCount, error } = await query;

    if (error) {
      console.error('Error fetching user conversations:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    // RLS will have filtered out any conversations the user doesn't have access to
    console.log(`User ${user.id} requested ${userId}'s conversations: found ${conversations?.length || 0} accessible (total: ${totalCount})`);

    return NextResponse.json({
      success: true,
      conversations: conversations || [],
      totalCount: totalCount || 0
    });

  } catch (error) {
    console.error('Error in user-conversations API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
