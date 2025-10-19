import OpenAI from 'openai';
import { generateMockSummary, generateMockKeywords } from './mock-summarizer.js';
import { createAuthenticatedClient } from './supabase.js';

// Check if we're in development mode or if OpenAI API key is not set
const isDevelopment = process.env.DEVELOPMENT === 'true';
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

// Use fallback (mock) mode if:
// 1. DEVELOPMENT=true is set, OR
// 2. OPENAI_API_KEY is not configured
const useFallback = isDevelopment || !hasOpenAIKey;

const openai = useFallback ? null : new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  display: string;
  pastedContents?: Record<string, any>;
}

interface StructuredSummary {
  summary: string; // max 6 words
  problems: string[]; // each max 6 words
  progress: 'looping' | 'smooth';
}

interface ChatHistory {
  id: string;
  messages: Message[];
  account_id?: string | null;
  ai_summary?: string | null;
  ai_summary_generated_at?: string | null;
  ai_summary_message_count?: number | null;
  ai_keywords_type?: string[] | null;
  ai_keywords_topic?: string[] | null;
  ai_keywords_generated_at?: string | null;
  ai_keywords_message_count?: number | null;
  ai_title?: string | null;
  ai_title_generated_at?: string | null;
  updated_at: string;
}

interface UserPreferences {
  user_id: string;
  ai_summary_enabled: boolean;
  ai_title_enabled: boolean;
}

interface KeywordClassification {
  type: string[];
  topic: string[];
}

/**
 * Fetch user preferences from the database
 * Returns default preferences if not found
 */
async function getUserPreferences(userId: string, accessToken: string, refreshToken: string): Promise<UserPreferences> {
  try {
    const supabase = await createAuthenticatedClient(accessToken, refreshToken);
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return default preferences if not found
      console.log(`[Preferences] No preferences found for user ${userId}, using defaults`);
      return {
        user_id: userId,
        ai_summary_enabled: true,
        ai_title_enabled: true,
      };
    }

    return {
      user_id: data.user_id,
      ai_summary_enabled: data.ai_summary_enabled ?? true,
      ai_title_enabled: data.ai_title_enabled ?? true,
    };
  } catch (error) {
    console.error('[Preferences] Error fetching user preferences:', error);
    // Return defaults on error
    return {
      user_id: userId,
      ai_summary_enabled: true,
      ai_title_enabled: true,
    };
  }
}

async function generateSessionSummary(messages: Message[], retries = 3): Promise<string> {
  if (messages.length === 0) {
    return JSON.stringify({
      summary: 'No messages yet',
      problems: [],
      progress: 'smooth'
    });
  }

  // Use fallback summarizer if in development mode or OpenAI key not configured
  if (useFallback) {
    if (isDevelopment) {
      console.log('[Summary] Using fallback summarizer (DEVELOPMENT mode)');
    } else {
      console.log('[Summary] Using fallback summarizer (OPENAI_API_KEY not set)');
    }
    return generateMockSummary(messages);
  }

  // Ensure openai is available
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Construct conversation context for the AI
  const conversationText = messages
    .map((msg, idx) => `Message ${idx + 1}: ${msg.display}`)
    .join('\n\n');

  const prompt = `Analyze this AI coding assistant session and provide a structured summary.

Session transcript:
${conversationText}

Respond with ONLY valid JSON in this exact format:
\`\`\`json
{
  "summary": "max 6 words describing what user is doing",
  "problems": ["problem 1 (max 6 words)", "problem 2 (max 6 words)"],
  "progress": "looping" or "smooth"
}
\`\`\`

Rules:
- summary: Maximum 6 words describing the main task
- problems: Array of issues encountered (each max 6 words). Empty array if no problems.
- progress: "looping" if stuck/repeating same issues, "smooth" if making progress

Example:
\`\`\`json
{
  "summary": "Building authentication with Gmail API",
  "problems": ["OAuth token refresh failing", "Rate limit exceeded errors"],
  "progress": "looping"
}
\`\`\``;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing software development conversations. Always respond with valid JSON only, wrapped in ```json ``` code blocks.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || '';

      // Extract JSON from markdown code block
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch?.[1] ?? content;

      // Try to parse the JSON
      try {
        const parsed: StructuredSummary = JSON.parse(jsonString);

        // Validate the structure
        if (!parsed.summary || !Array.isArray(parsed.problems) || !parsed.progress) {
          throw new Error('Invalid JSON structure');
        }

        if (parsed.progress !== 'looping' && parsed.progress !== 'smooth') {
          parsed.progress = 'smooth'; // Default to smooth if invalid
        }

        // Return as JSON string
        return JSON.stringify(parsed);
      } catch (parseError) {
        console.error(`[Summary] JSON parsing failed on attempt ${attempt + 1}:`, parseError);
        console.error('[Summary] Received content:', content);

        // If this is not the last retry, try again
        if (attempt < retries) {
          console.log(`[Summary] Retrying due to parse error (${attempt + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Last attempt failed, return a fallback
        return JSON.stringify({
          summary: 'Summary generation failed',
          problems: ['JSON parsing error'],
          progress: 'smooth'
        });
      }
    } catch (error: any) {
      // Handle rate limit errors with exponential backoff
      if (error?.code === 'rate_limit_exceeded' && attempt < retries) {
        const waitTime = error?.error?.message?.match(/try again in (\d+)ms/)?.[1];
        const delayMs = waitTime ? parseInt(waitTime) + 100 : Math.pow(2, attempt) * 1000;

        console.log(`[Summary] Rate limit hit, waiting ${delayMs}ms before retry ${attempt + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      console.error('Error generating summary with GPT-4o-mini:', error);

      // Return fallback on error
      return JSON.stringify({
        summary: 'Error generating summary',
        problems: [],
        progress: 'smooth'
      });
    }
  }

  throw new Error('Failed to generate summary after retries');
}

async function generateKeywordClassification(messages: Message[], retries = 3): Promise<KeywordClassification> {
  if (messages.length === 0) {
    return { type: [], topic: [] };
  }

  // Use fallback keyword extraction if in development mode or OpenAI key not configured
  if (useFallback) {
    if (isDevelopment) {
      console.log('[Keywords] Using fallback keyword extraction (DEVELOPMENT mode)');
    } else {
      console.log('[Keywords] Using fallback keyword extraction (OPENAI_API_KEY not set)');
    }
    return generateMockKeywords(messages);
  }

  // Ensure openai is available
  if (!openai) {
    return { type: [], topic: [] };
  }

  // Construct conversation context for the AI
  const conversationText = messages
    .map((msg, idx) => `Message ${idx + 1}: ${msg.display}`)
    .join('\n\n');

  const prompt = `Analyze this AI coding assistant session and classify it using keywords.

Session transcript:
${conversationText}

Provide a JSON response with two arrays:
1. "type": Array of work types (choose 1-3 from: bug, feature, refactor, documentation, testing, deployment, configuration, optimization, debugging, learning, exploration)
2. "topic": Array of specific topics/technologies the user is working on (e.g., "gmail integration", "whatsapp authentication", "database schema", "API endpoints"). Be specific and concise (2-4 words each). Limit to 3-5 most relevant topics.

Respond ONLY with valid JSON in this exact format:
{"type": ["feature", "refactor"], "topic": ["gmail integration", "email parser"]}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing software development conversations and extracting structured keyword classifications. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"type": [], "topic": []}';
      const parsed = JSON.parse(content);

      // Validate and sanitize the response
      return {
        type: Array.isArray(parsed.type) ? parsed.type.slice(0, 3) : [],
        topic: Array.isArray(parsed.topic) ? parsed.topic.slice(0, 5) : [],
      };
    } catch (error: any) {
      // Handle rate limit errors with exponential backoff
      if (error?.code === 'rate_limit_exceeded' && attempt < retries) {
        const waitTime = error?.error?.message?.match(/try again in (\d+)ms/)?.[1];
        const delayMs = waitTime ? parseInt(waitTime) + 100 : Math.pow(2, attempt) * 1000;

        console.log(`[Keywords] Rate limit hit, waiting ${delayMs}ms before retry ${attempt + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      console.error('Error generating keywords with GPT-4o-mini:', error);
      // Return empty arrays on error instead of throwing
      return { type: [], topic: [] };
    }
  }

  return { type: [], topic: [] };
}

async function generateSessionTitle(messages: Message[], retries = 3): Promise<string> {
  if (messages.length === 0) {
    return 'Empty Session';
  }

  // Use fallback title generation if in development mode or OpenAI key not configured
  if (useFallback) {
    if (isDevelopment) {
      console.log('[Title] Using fallback title generation (DEVELOPMENT mode)');
    } else {
      console.log('[Title] Using fallback title generation (OPENAI_API_KEY not set)');
    }
    // Generate a simple title from first few messages
    const firstMessage = messages[0]?.display || '';
    return firstMessage.slice(0, 50).trim() + (firstMessage.length > 50 ? '...' : '');
  }

  // Ensure openai is available
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Construct conversation context for the AI
  const conversationText = messages
    .slice(0, 5) // Only use first 5 messages for title
    .map((msg, idx) => `Message ${idx + 1}: ${msg.display}`)
    .join('\n\n');

  const prompt = `Generate a short, descriptive title (4-8 words) for this coding session that captures what the user is working on.

Session transcript:
${conversationText}

Provide ONLY the title, nothing else:`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating concise, descriptive titles for software development sessions. Respond with only the title.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 50,
      });

      return response.choices[0]?.message?.content?.trim() || 'Coding Session';
    } catch (error: any) {
      // Handle rate limit errors with exponential backoff
      if (error?.code === 'rate_limit_exceeded' && attempt < retries) {
        const waitTime = error?.error?.message?.match(/try again in (\d+)ms/)?.[1];
        const delayMs = waitTime ? parseInt(waitTime) + 100 : Math.pow(2, attempt) * 1000;

        console.log(`[Title] Rate limit hit, waiting ${delayMs}ms before retry ${attempt + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      console.error('Error generating title with GPT-4o-mini:', error);
      throw error;
    }
  }

  throw new Error('Failed to generate title after retries');
}

/**
 * Fetches sessions that need summary updates.
 * Returns sessions that:
 * 1. Were created within the specified time window (default 24 hours)
 * 2. Either have no summary OR meet the update thresholds:
 *    - At least 10 new messages since last summary, AND
 *    - At least 30 minutes since last summary generation
 * 3. User has AI summaries enabled in preferences
 */
export async function getSessionsNeedingSummaryUpdate(
  withinHours: number = 24,
  accessToken: string,
  refreshToken: string
): Promise<ChatHistory[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - withinHours);

  // Cost-saving thresholds
  const MESSAGE_THRESHOLD = 10; // Only update after 10 new messages
  const TIME_THROTTLE_MINUTES = 30; // Wait at least 30 minutes between updates

  console.log(`[Summary Updater] Fetching sessions needing summary update...`);
  console.log(`[Summary Updater] Cutoff time: ${cutoffTime.toISOString()}`);
  console.log(`[Summary Updater] Thresholds: ${MESSAGE_THRESHOLD} messages, ${TIME_THROTTLE_MINUTES} minutes`);

  // Fetch recent sessions
  const supabase = await createAuthenticatedClient(accessToken, refreshToken);
  const { data, error } = await supabase
    .from('chat_histories')
    .select('*')
    .gte('latest_message_timestamp', cutoffTime.toISOString())
    .order('latest_message_timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching sessions for summary update:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get unique account IDs and batch fetch all preferences at once
  const uniqueAccountIds = [...new Set(data.map(s => s.account_id).filter(Boolean))];
  const preferencesMap = new Map<string, UserPreferences>();

  // Fetch all preferences in parallel
  await Promise.all(
    uniqueAccountIds.map(async (accountId: string) => {
      const prefs = await getUserPreferences(accountId, accessToken, refreshToken);
      preferencesMap.set(accountId, prefs);
    })
  );

  // Filter sessions based on user preferences and update needs
  const needsUpdate: ChatHistory[] = [];

  for (const session of data) {
    const currentMessageCount = Array.isArray(session.messages)
      ? session.messages.length
      : 0;

    // Skip sessions with no messages
    if (currentMessageCount === 0) {
      continue;
    }

    // Skip if no account_id (can't check preferences)
    if (!session.account_id) {
      continue;
    }

    // Check user preferences from cache
    const preferences = preferencesMap.get(session.account_id);
    if (!preferences || !preferences.ai_summary_enabled) {
      continue;
    }

    // Always update if no summary exists
    if (!session.ai_summary || !session.ai_summary_generated_at) {
      needsUpdate.push(session);
      continue;
    }

    // Calculate messages since last summary
    const messagesSinceLastSummary = currentMessageCount - (session.ai_summary_message_count || 0);

    // Calculate time since last summary
    const lastSummaryTime = new Date(session.ai_summary_generated_at);
    const minutesSinceLastSummary = (Date.now() - lastSummaryTime.getTime()) / 1000 / 60;

    // Only update if BOTH thresholds are met (cost-effective approach)
    if (
      messagesSinceLastSummary >= MESSAGE_THRESHOLD &&
      minutesSinceLastSummary >= TIME_THROTTLE_MINUTES
    ) {
      needsUpdate.push(session);
    }
  }

  return needsUpdate;
}

/**
 * Fetches sessions that need keyword updates.
 * Returns sessions that:
 * 1. Were created within the specified time window (default 24 hours)
 * 2. Either have no keywords OR meet the update thresholds:
 *    - At least 10 new messages since last keyword generation, AND
 *    - At least 30 minutes since last keyword generation
 * 3. User has AI summaries enabled in preferences
 */
export async function getSessionsNeedingKeywordUpdate(
  withinHours: number = 24,
  accessToken: string,
  refreshToken: string
): Promise<ChatHistory[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - withinHours);

  // Cost-saving thresholds (same as summary updates)
  const MESSAGE_THRESHOLD = 10; // Only update after 10 new messages
  const TIME_THROTTLE_MINUTES = 30; // Wait at least 30 minutes between updates

  console.log(`[Keyword Updater] Fetching sessions needing keyword update...`);
  console.log(`[Keyword Updater] Cutoff time: ${cutoffTime.toISOString()}`);
  console.log(`[Keyword Updater] Thresholds: ${MESSAGE_THRESHOLD} messages, ${TIME_THROTTLE_MINUTES} minutes`);

  // Fetch recent sessions
  const supabase = await createAuthenticatedClient(accessToken, refreshToken);
  const { data, error } = await supabase
    .from('chat_histories')
    .select('*')
    .gte('latest_message_timestamp', cutoffTime.toISOString())
    .order('latest_message_timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching sessions for keyword update:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get unique account IDs and batch fetch all preferences at once
  const uniqueAccountIds = [...new Set(data.map(s => s.account_id).filter(Boolean))];
  const preferencesMap = new Map<string, UserPreferences>();

  // Fetch all preferences in parallel
  await Promise.all(
    uniqueAccountIds.map(async (accountId: string) => {
      const prefs = await getUserPreferences(accountId, accessToken, refreshToken);
      preferencesMap.set(accountId, prefs);
    })
  );

  // Filter sessions based on user preferences and update needs
  const needsUpdate: ChatHistory[] = [];

  for (const session of data) {
    const currentMessageCount = Array.isArray(session.messages)
      ? session.messages.length
      : 0;

    // Skip sessions with no messages
    if (currentMessageCount === 0) {
      continue;
    }

    // Skip if no account_id (can't check preferences)
    if (!session.account_id) {
      continue;
    }

    // Check user preferences from cache
    const preferences = preferencesMap.get(session.account_id);
    if (!preferences || !preferences.ai_summary_enabled) {
      continue;
    }

    // Always update if no keywords exist
    if (!session.ai_keywords_generated_at) {
      needsUpdate.push(session);
      continue;
    }

    // Calculate messages since last keyword generation
    const messagesSinceLastKeywords = currentMessageCount - (session.ai_keywords_message_count || 0);

    // Calculate time since last keyword generation
    const lastKeywordsTime = new Date(session.ai_keywords_generated_at);
    const minutesSinceLastKeywords = (Date.now() - lastKeywordsTime.getTime()) / 1000 / 60;

    // Only update if BOTH thresholds are met (cost-effective approach)
    if (
      messagesSinceLastKeywords >= MESSAGE_THRESHOLD &&
      minutesSinceLastKeywords >= TIME_THROTTLE_MINUTES
    ) {
      needsUpdate.push(session);
    }
  }

  return needsUpdate;
}

/**
 * Fetches sessions that need title updates.
 * Returns sessions that:
 * 1. Were created within the specified time window (default 24 hours)
 * 2. Don't have an AI-generated title yet
 * 3. Don't already have a conversation name in metadata (e.g., from Cursor)
 * 4. User has AI titles enabled in preferences
 */
export async function getSessionsNeedingTitleUpdate(
  withinHours: number = 24,
  accessToken: string,
  refreshToken: string
): Promise<ChatHistory[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - withinHours);

  // Fetch recent sessions
  const supabase = await createAuthenticatedClient(accessToken, refreshToken);
  const { data, error } = await supabase
    .from('chat_histories')
    .select('*')
    .gte('latest_message_timestamp', cutoffTime.toISOString())
    .order('latest_message_timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching sessions for title update:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get unique account IDs and batch fetch all preferences at once
  const uniqueAccountIds = [...new Set(data.map(s => s.account_id).filter(Boolean))];
  const preferencesMap = new Map<string, UserPreferences>();

  // Fetch all preferences in parallel
  await Promise.all(
    uniqueAccountIds.map(async (accountId: string) => {
      const prefs = await getUserPreferences(accountId, accessToken, refreshToken);
      preferencesMap.set(accountId, prefs);
    })
  );

  // Filter sessions that need title generation
  const needsUpdate: ChatHistory[] = [];

  for (const session of data) {
    const currentMessageCount = Array.isArray(session.messages)
      ? session.messages.length
      : 0;

    // Skip sessions with no messages
    if (currentMessageCount === 0) {
      continue;
    }

    // Skip if no account_id (can't check preferences)
    if (!session.account_id) {
      continue;
    }

    // Check user preferences from cache
    const preferences = preferencesMap.get(session.account_id);
    if (!preferences || !preferences.ai_title_enabled) {
      continue;
    }

    // Skip if already has an AI-generated title
    if (session.ai_title && session.ai_title_generated_at) {
      continue;
    }

    // Check if has a conversation name in metadata (e.g., from Cursor)
    const metadata = session.metadata as any;
    const conversationName = metadata?.conversationName || metadata?.conversation_name;

    // Add to update list if:
    // 1. Has conversation name but no ai_title (copy over the name), OR
    // 2. Has no conversation name and no ai_title (generate new title)
    if (conversationName || !session.ai_title) {
      needsUpdate.push(session);
    }
  }

  return needsUpdate;
}

/**
 * Generate and save summary for a single session
 */
export async function updateSessionSummary(
  sessionId: string,
  accessToken: string,
  refreshToken: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    // Fetch the session
    const supabase = await createAuthenticatedClient(accessToken, refreshToken);
    const { data: session, error: fetchError } = await supabase
      .from('chat_histories')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    const messages = Array.isArray(session.messages) ? session.messages : [];
    const messageCount = messages.length;

    if (messageCount === 0) {
      return { success: false, error: 'No messages to summarize' };
    }

    // Generate summary
    const summary = await generateSessionSummary(messages);

    // Update database
    const { error: updateError } = await supabase
      .from('chat_histories')
      .update({
        ai_summary: summary,
        ai_summary_generated_at: new Date().toISOString(),
        ai_summary_message_count: messageCount,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating summary in database:', updateError);
      return { success: false, error: 'Failed to save summary' };
    }

    return { success: true, summary };
  } catch (error) {
    console.error(`Error updating summary for session ${sessionId}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate and save keywords for a single session
 */
export async function updateSessionKeywords(
  sessionId: string,
  accessToken: string,
  refreshToken: string
): Promise<{ success: boolean; keywords?: KeywordClassification; error?: string }> {
  try {
    // Fetch the session
    const supabase = await createAuthenticatedClient(accessToken, refreshToken);
    const { data: session, error: fetchError } = await supabase
      .from('chat_histories')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    const messages = Array.isArray(session.messages) ? session.messages : [];
    const messageCount = messages.length;

    if (messageCount === 0) {
      return { success: false, error: 'No messages to classify' };
    }

    // Generate keywords
    const keywords = await generateKeywordClassification(messages);

    // Update database
    const { error: updateError } = await supabase
      .from('chat_histories')
      .update({
        ai_keywords_type: keywords.type,
        ai_keywords_topic: keywords.topic,
        ai_keywords_generated_at: new Date().toISOString(),
        ai_keywords_message_count: messageCount,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating keywords in database:', updateError);
      return { success: false, error: 'Failed to save keywords' };
    }

    return { success: true, keywords };
  } catch (error) {
    console.error(`Error updating keywords for session ${sessionId}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate and save title for a single session
 */
export async function updateSessionTitle(
  sessionId: string,
  accessToken: string,
  refreshToken: string
): Promise<{ success: boolean; title?: string; error?: string }> {
  try {
    // Fetch the session
    const supabase = await createAuthenticatedClient(accessToken, refreshToken);
    const { data: session, error: fetchError } = await supabase
      .from('chat_histories')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    const messages = Array.isArray(session.messages) ? session.messages : [];

    if (messages.length === 0) {
      return { success: false, error: 'No messages to generate title from' };
    }

    // Check if has a conversation name in metadata
    const metadata = session.metadata as any;
    const conversationName = metadata?.conversationName || metadata?.conversation_name;

    let title: string;

    if (conversationName) {
      // Use conversation name from metadata as the title
      title = conversationName;
    } else {
      // Generate title from messages
      title = await generateSessionTitle(messages);
    }

    // Update database
    const { error: updateError } = await supabase
      .from('chat_histories')
      .update({
        ai_title: title,
        ai_title_generated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating title in database:', updateError);
      return { success: false, error: 'Failed to save title' };
    }

    return { success: true, title };
  } catch (error) {
    console.error(`Error updating title for session ${sessionId}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Batch update summaries for multiple sessions with rate limit handling
 * Processes sessions sequentially with delays to avoid rate limits
 */
export async function batchUpdateSessionSummaries(
  sessionIds: string[],
  accessToken: string,
  refreshToken: string,
  delayBetweenRequests: number = 100
): Promise<{
  updated: number;
  cached: number;
  errors: number;
  results: any[];
}> {
  const results: any[] = [];

  // Process sequentially to avoid overwhelming rate limits
  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];

    if (!sessionId) continue;

    try {
      const result = await updateSessionSummary(sessionId, accessToken, refreshToken);
      results.push({ sessionId, ...result });

      // Add delay between requests (except for last one)
      if (i < sessionIds.length - 1 && result.success) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    } catch (error) {
      results.push({
        sessionId,
        success: false,
        error: String(error),
      });
    }
  }

  return {
    updated: results.filter((r) => r.success).length,
    cached: 0, // Not using cache in daemon version
    errors: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Batch update keywords for multiple sessions with rate limit handling
 * Processes sessions sequentially with delays to avoid rate limits
 */
export async function batchUpdateSessionKeywords(
  sessionIds: string[],
  accessToken: string,
  refreshToken: string,
  delayBetweenRequests: number = 100
): Promise<{
  updated: number;
  cached: number;
  errors: number;
  results: any[];
}> {
  const results: any[] = [];

  // Process sequentially to avoid overwhelming rate limits
  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];

    if (!sessionId) continue;

    try {
      const result = await updateSessionKeywords(sessionId, accessToken, refreshToken);
      results.push({ sessionId, ...result });

      // Add delay between requests (except for last one)
      if (i < sessionIds.length - 1 && result.success) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    } catch (error) {
      results.push({
        sessionId,
        success: false,
        error: String(error),
      });
    }
  }

  return {
    updated: results.filter((r) => r.success).length,
    cached: 0, // Not using cache in daemon version
    errors: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Main function to run periodic summary updates
 * Should be called every 5 minutes
 * Only processes sessions updated within the last 24 hours
 */
export async function runPeriodicSummaryUpdate(accessToken: string, refreshToken: string): Promise<void> {
  console.log('[Summary Updater] Starting periodic summary update...');

  try {
    // Get sessions from the last 24 hours that need updates
    const sessions = await getSessionsNeedingSummaryUpdate(24, accessToken, refreshToken);

    if (sessions.length === 0) {
      console.log('[Summary Updater] No sessions need updating');
      return;
    }

    console.log(`[Summary Updater] Found ${sessions.length} sessions needing summary updates`);

    // Batch update all sessions
    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionSummaries(sessionIds, accessToken, refreshToken);

    console.log('[Summary Updater] Update complete:', {
      total: sessionIds.length,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Summary Updater] Error during periodic update:', error);
  }
}

/**
 * Main function to run periodic keyword updates
 * Should be called every 5 minutes (same schedule as summary updates)
 * Only processes sessions updated within the last 24 hours
 */
export async function runPeriodicKeywordUpdate(accessToken: string, refreshToken: string): Promise<void> {
  console.log('[Keyword Updater] Starting periodic keyword update...');

  try {
    // Get sessions from the last 24 hours that need keyword updates
    const sessions = await getSessionsNeedingKeywordUpdate(24, accessToken, refreshToken);

    if (sessions.length === 0) {
      console.log('[Keyword Updater] No sessions need updating');
      return;
    }

    console.log(`[Keyword Updater] Found ${sessions.length} sessions needing keyword updates`);

    // Batch update all sessions
    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionKeywords(sessionIds, accessToken, refreshToken);

    console.log('[Keyword Updater] Update complete:', {
      total: sessionIds.length,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Keyword Updater] Error during periodic update:', error);
  }
}

/**
 * Batch update titles for multiple sessions with rate limit handling
 * Processes sessions sequentially with delays to avoid rate limits
 */
export async function batchUpdateSessionTitles(
  sessionIds: string[],
  accessToken: string,
  refreshToken: string,
  delayBetweenRequests: number = 100
): Promise<{
  updated: number;
  cached: number;
  errors: number;
  results: any[];
}> {
  const results: any[] = [];

  // Process sequentially to avoid overwhelming rate limits
  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];

    if (!sessionId) continue;

    try {
      const result = await updateSessionTitle(sessionId, accessToken, refreshToken);
      results.push({ sessionId, ...result });

      // Add delay between requests (except for last one)
      if (i < sessionIds.length - 1 && result.success) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    } catch (error) {
      results.push({
        sessionId,
        success: false,
        error: String(error),
      });
    }
  }

  return {
    updated: results.filter((r) => r.success).length,
    cached: 0, // Not using cache in daemon version
    errors: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Main function to run periodic title updates
 * Should be called every 5 minutes (same schedule as summary updates)
 * Only processes sessions updated within the last 24 hours
 */
export async function runPeriodicTitleUpdate(accessToken: string, refreshToken: string): Promise<void> {
  console.log('[Title Updater] Starting periodic title update...');

  try {
    // Get sessions from the last 24 hours that need title updates
    const sessions = await getSessionsNeedingTitleUpdate(24, accessToken, refreshToken);

    if (sessions.length === 0) {
      console.log('[Title Updater] No sessions need updating');
      return;
    }

    console.log(`[Title Updater] Found ${sessions.length} sessions needing title updates`);

    // Batch update all sessions
    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionTitles(sessionIds, accessToken, refreshToken);

    console.log('[Title Updater] Update complete:', {
      total: sessionIds.length,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Title Updater] Error during periodic update:', error);
  }
}
