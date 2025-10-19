import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

interface MentionedUser {
  id: string;
  email: string;
  display_name: string | null;
  mentionText: string;
}

interface ChatRequest {
  message: string;
  mentionedUsers: MentionedUser[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ChatRequest = await request.json();
    const { message, mentionedUsers = [] } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if message contains @ mentions asking about users
    const hasMentionQuery = mentionedUsers.length > 0;

    if (!hasMentionQuery) {
      // Simple echo response if no mentions
      return NextResponse.json({
        response:
          'I can help you understand what your teammates are working on! Try mentioning someone with @ to ask about their recent activity.',
        type: 'info',
      });
    }

    // Fetch user's LLM API key (prefer OpenAI or Anthropic)
    const { data: apiKeys, error: keysError } = await supabase
      .from('llm_api_keys')
      .select('provider, api_key')
      .eq('account_id', user.id)
      .eq('is_active', true)
      .in('provider', ['openai', 'anthropic']);

    if (keysError || !apiKeys || apiKeys.length === 0) {
      return NextResponse.json(
        {
          error:
            'No LLM API key found. Please configure your OpenAI or Anthropic API key in settings.',
          type: 'error',
        },
        { status: 400 }
      );
    }

    // Use the first available key
    const apiKey = apiKeys[0];

    // Fetch context for each mentioned user
    const userContexts = await Promise.all(
      mentionedUsers.map(async (mentionedUser) => {
        try {
          const contextResponse = await fetch(
            `${request.nextUrl.origin}/api/users/${mentionedUser.id}/context`,
            {
              headers: {
                Cookie: request.headers.get('cookie') || '',
              },
            }
          );

          if (!contextResponse.ok) {
            const errorText = await contextResponse.text();
            console.error(
              `Failed to fetch context for user ${mentionedUser.id}:`,
              contextResponse.status,
              errorText.substring(0, 500)
            );
            return {
              user: mentionedUser,
              context: null,
              error: 'Failed to fetch context',
            };
          }

          const contextData = await contextResponse.json();
          return {
            user: mentionedUser,
            context: contextData.context,
            error: null,
          };
        } catch (error) {
          console.error(
            `Error fetching context for user ${mentionedUser.id}:`,
            error
          );
          return {
            user: mentionedUser,
            context: null,
            error: 'Failed to fetch context',
          };
        }
      })
    );

    // Build prompt for LLM
    const systemPrompt = `You are a helpful assistant that provides insights about what team members are working on based on their recent chat history with AI coding assistants.

You will be given:
1. A user's question about their teammates
2. Recent chat history and context for the mentioned users

Your job is to:
- Analyze the recent messages and AI summaries
- Provide a clear, concise answer about what the user is working on or struggling with
- Highlight any recent problems, errors, or challenges they've faced
- Mention relevant projects they're working on
- Be conversational and helpful

If there's not enough information, say so politely and suggest the user check in directly with their teammate.`;

    const userContextSummaries = userContexts
      .map((uc) => {
        const userName =
          uc.user.display_name || uc.user.email.split('@')[0];

        if (uc.error || !uc.context) {
          return `\n${userName}: No recent activity found.`;
        }

        const ctx = uc.context;
        const recentMessages = ctx.recent_messages
          .slice(0, 10)
          .map(
            (msg: any) =>
              `  - [${msg.role}] ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
          )
          .join('\n');

        const summaries = ctx.ai_summaries
          ?.map((s: any) => `  - ${s.summary}`)
          .join('\n');

        return `
${userName} (${uc.user.email}):
- Most recent activity: ${ctx.most_recent_activity || 'Unknown'}
- Active projects: ${ctx.active_projects?.join(', ') || 'None'}
- Recent messages (${ctx.recent_messages.length} total):
${recentMessages || '  No recent messages'}
${summaries ? `- AI Summaries:\n${summaries}` : ''}`;
      })
      .join('\n---\n');

    const userPrompt = `User's question: "${message}"

Context for mentioned users:
${userContextSummaries}

Please provide a helpful response based on the above context.`;

    // Call appropriate LLM API
    let llmResponse: string;

    if (apiKey.provider === 'openai') {
      llmResponse = await callOpenAI(apiKey.api_key, systemPrompt, userPrompt);
    } else if (apiKey.provider === 'anthropic') {
      llmResponse = await callAnthropic(
        apiKey.api_key,
        systemPrompt,
        userPrompt
      );
    } else {
      return NextResponse.json(
        { error: 'Unsupported LLM provider' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      response: llmResponse,
      type: 'success',
      mentionedUsers: mentionedUsers.map((u) => ({
        id: u.id,
        name: u.display_name || u.email.split('@')[0],
      })),
    });
  } catch (error) {
    console.error('Unexpected error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error('Failed to get response from OpenAI');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No response generated';
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Anthropic API error:', error);
    throw new Error('Failed to get response from Anthropic');
  }

  const data = await response.json();
  return data.content[0]?.text || 'No response generated';
}
