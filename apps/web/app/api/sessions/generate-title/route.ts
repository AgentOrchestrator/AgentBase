import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { generateText } from 'ai';

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

    // Fetch the user's OpenAI API key from llm_api_keys table
    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from('llm_api_keys')
      .select('api_key, provider')
      .eq('account_id', user.id)
      .eq('provider', 'openai')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    let apiKey: string;
    if (apiKeyError || !apiKeyRecord) {
      // Fallback to environment variable if no user key found
      const envApiKey = process.env.OPENAI_API_KEY;
      if (!envApiKey) {
        return NextResponse.json(
          { success: false, error: 'No OpenAI API key found. Please add one in Settings.' },
          { status: 400 }
        );
      }
      apiKey = envApiKey;
    } else {
      apiKey = apiKeyRecord.api_key;
    }

    // Create OpenAI provider with the API key
    const { createOpenAI } = await import('@ai-sdk/openai');
    const openaiProvider = createOpenAI({
      apiKey,
    });

    const { text } = await generateText({
      model: openaiProvider('gpt-4o-mini'),
      prompt: `Based on the following conversation, generate a short, descriptive title (max 5-7 words). Only respond with the title, nothing else.

Conversation:
${conversationPreview}`,
    });

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
