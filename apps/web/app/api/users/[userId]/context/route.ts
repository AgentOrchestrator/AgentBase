import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{
    userId: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient();
    const { userId } = await params;

    // Verify the requesting user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the most recent chat messages from the specified user
    // Limit to last 50 messages across all sessions for context
    const { data: chatHistories, error } = await supabase
      .from('chat_histories')
      .select('id, messages, metadata, agent_type, latest_message_timestamp, ai_summary, created_at, updated_at')
      .eq('account_id', userId)
      .order('latest_message_timestamp', { ascending: false })
      .limit(10); // Get last 10 sessions

    if (error) {
      console.error('Error fetching chat histories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chat context' },
        { status: 500 }
      );
    }

    // Extract and flatten recent messages
    const recentMessages: Array<{
      session_id: string;
      role: string;
      content: string;
      timestamp: string;
      project: string | null;
      agent_type: string | null;
      ai_summary: string | null;
    }> = [];

    for (const session of chatHistories || []) {
      const messages = session.messages || [];

      // Take the last 5 messages from each session
      const sessionMessages = messages.slice(-5).map((msg: any) => ({
        session_id: session.id,
        role: msg.role || 'user',
        content: msg.display || '',
        timestamp: msg.timestamp || session.latest_message_timestamp || session.updated_at,
        project: session.metadata?.projectPath || session.metadata?.projectName || null,
        agent_type: session.agent_type,
        ai_summary: session.ai_summary,
      }));

      recentMessages.push(...sessionMessages);
    }

    // Sort by timestamp descending and limit to 50 most recent messages
    recentMessages.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const limitedMessages = recentMessages.slice(0, 50);

    // Build context summary
    const contextSummary = {
      user_id: userId,
      total_sessions: chatHistories?.length || 0,
      recent_messages: limitedMessages,
      most_recent_activity: chatHistories?.[0]?.latest_message_timestamp || null,
      active_projects: [
        ...new Set(
          chatHistories
            ?.map((s) => s.metadata?.projectPath || s.metadata?.projectName)
            .filter(Boolean)
        ),
      ].slice(0, 5),
      ai_summaries: chatHistories
        ?.filter((s) => s.ai_summary)
        .map((s) => ({
          session_id: s.id,
          summary: s.ai_summary,
          project: s.metadata?.projectPath || s.metadata?.projectName || null,
        }))
        .slice(0, 5),
    };

    return NextResponse.json({ context: contextSummary });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
