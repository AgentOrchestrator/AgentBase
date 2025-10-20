import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserLLMConfig, generateLLMText } from '@/lib/llm-client';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the session with RLS check
    const { data: session, error: sessionError } = await supabase
      .from('chat_histories')
      .select('id, account_id, messages')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (session.account_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get the first few messages to generate a title
    const messages = session.messages || [];
    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages found in session' },
        { status: 400 }
      );
    }

    // Take the first 5 messages or all if less than 5
    const firstMessages = messages.slice(0, 5);
    const conversationPreview = firstMessages
      .map((msg: any) => `${msg.role}: ${msg.display || msg.content || ''}`)
      .join('\n\n');

    // Get user's LLM configuration based on their preferences
    const llmConfig = await getUserLLMConfig(user.id);

    if (!llmConfig) {
      return NextResponse.json(
        { success: false, error: 'No LLM API key found. Please configure an API key in Settings.' },
        { status: 400 }
      );
    }

    // Generate title using user's preferred model
    const text = await generateLLMText(
      llmConfig,
      `Based on the following conversation, generate a short, descriptive title (max 5-7 words). Only respond with the title, nothing else.

Conversation:
${conversationPreview}`,
      undefined,
      {
        temperature: 0.7,
        maxTokens: 50,
      }
    );

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate title' },
        { status: 500 }
      );
    }

    const generatedTitle = text.trim() || 'Untitled Conversation';

    // Update the session with the generated title
    const { error: updateError } = await supabase
      .from('chat_histories')
      .update({ ai_title: generatedTitle })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session title:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update title' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      title: generatedTitle
    });

  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate title' },
      { status: 500 }
    );
  }
}
