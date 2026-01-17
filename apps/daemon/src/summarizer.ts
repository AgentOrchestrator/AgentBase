import { generateMockSummary, generateMockKeywords } from './mock-summarizer.js';
import { getUserLLMConfig, generateLLMText, type LLMConfig, getUserPreferences } from './llm-client.js';
import type {
  IChatHistoryRepository,
  IUserPreferencesRepository,
  IApiKeyRepository,
  IRepositoryFactory,
  ChatHistoryRecord,
} from './interfaces/repositories.js';
import type { ServiceContainer } from './service-container.js';

// Check if we're in development mode
const isDevelopment = process.env.DEVELOPMENT === 'true';

interface Message {
  display: string;
  pastedContents?: Record<string, any>;
}

interface StructuredSummary {
  summary: string; // max 6 words
  problems: string[]; // each max 6 words
  progress: 'looping' | 'smooth';
}

interface KeywordClassification {
  type: string[];
  topic: string[];
}

/**
 * Context for summarizer operations
 * Contains all repositories needed for AI processing
 */
export interface SummarizerContext {
  userId: string;
  chatHistories: IChatHistoryRepository;
  userPreferences: IUserPreferencesRepository;
  apiKeys: IApiKeyRepository;
}

async function generateSessionSummary(
  messages: Message[],
  llmConfig: LLMConfig,
  retries = 3
): Promise<string> {
  if (messages.length === 0) {
    return JSON.stringify({
      summary: 'No messages yet',
      problems: [],
      progress: 'smooth'
    });
  }

  // Use fallback summarizer if in development mode
  if (isDevelopment) {
    console.log('[Summary] Using fallback summarizer (DEVELOPMENT mode)');
    return generateMockSummary(messages);
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

  const systemPrompt = 'You are an expert at analyzing software development conversations. Always respond with valid JSON only, wrapped in ```json ``` code blocks.';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const content = await generateLLMText(
        llmConfig,
        prompt,
        systemPrompt,
        {
          temperature: 0.3,
          maxTokens: 200,
        }
      );

      if (!content) {
        // No LLM available, use fallback
        console.log('[Summary] No LLM available, using fallback summarizer');
        return generateMockSummary(messages);
      }

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

async function generateKeywordClassification(
  messages: Message[],
  llmConfig: LLMConfig,
  retries = 3
): Promise<KeywordClassification> {
  if (messages.length === 0) {
    return { type: [], topic: [] };
  }

  // Use fallback keyword extraction if in development mode
  if (isDevelopment) {
    console.log('[Keywords] Using fallback keyword extraction (DEVELOPMENT mode)');
    return generateMockKeywords(messages);
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

  const systemPrompt = 'You are an expert at analyzing software development conversations and extracting structured keyword classifications. Always respond with valid JSON only.';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const content = await generateLLMText(
        llmConfig,
        prompt,
        systemPrompt,
        {
          temperature: 0.3,
          maxTokens: 150,
        }
      );

      if (!content) {
        // No LLM available, use fallback
        console.log('[Keywords] No LLM available, using fallback keyword extraction');
        return generateMockKeywords(messages);
      }

      // Extract JSON from markdown code block (same as summary generation)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch?.[1] ?? content;

      const parsed = JSON.parse(jsonString);

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

async function generateSessionTitle(
  messages: Message[],
  llmConfig: LLMConfig,
  retries = 3
): Promise<string> {
  if (messages.length === 0) {
    return 'Empty Session';
  }

  // Use fallback title generation if in development mode
  if (isDevelopment) {
    console.log('[Title] Using fallback title generation (DEVELOPMENT mode)');
    // Generate a simple title from first few messages
    const firstMessage = messages[0]?.display || '';
    return firstMessage.slice(0, 50).trim() + (firstMessage.length > 50 ? '...' : '');
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

  const systemPrompt = 'You are an expert at creating concise, descriptive titles for software development sessions. Respond with only the title.';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const content = await generateLLMText(
        llmConfig,
        prompt,
        systemPrompt,
        {
          temperature: 0.7,
          maxTokens: 50,
        }
      );

      if (!content) {
        // No LLM available, use fallback
        console.log('[Title] No LLM available, using fallback title generation');
        const firstMessage = messages[0]?.display || '';
        return firstMessage.slice(0, 50).trim() + (firstMessage.length > 50 ? '...' : '');
      }

      return content.trim() || 'Coding Session';
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
 */
export async function getSessionsNeedingSummaryUpdate(
  ctx: SummarizerContext,
  withinHours: number = 24
): Promise<ChatHistoryRecord[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - withinHours);

  // Cost-saving thresholds
  const MESSAGE_THRESHOLD = 10;
  const TIME_THROTTLE_MINUTES = 30;

  console.log(`[Summary Updater] Fetching sessions needing summary update...`);
  console.log(`[Summary Updater] Cutoff time: ${cutoffTime.toISOString()}`);
  console.log(`[Summary Updater] Thresholds: ${MESSAGE_THRESHOLD} messages, ${TIME_THROTTLE_MINUTES} minutes`);

  const sessions = await ctx.chatHistories.findRecentByUser(ctx.userId, cutoffTime);

  if (sessions.length === 0) {
    return [];
  }

  const preferences = await getUserPreferences(ctx.userPreferences, ctx.userId);

  // Filter sessions based on user preferences and update needs
  const needsUpdate: ChatHistoryRecord[] = [];

  for (const session of sessions) {
    const currentMessageCount = Array.isArray(session.messages)
      ? session.messages.length
      : 0;

    if (currentMessageCount === 0) {
      continue;
    }

    if (!preferences || !preferences.aiSummaryEnabled) {
      continue;
    }

    if (!session.aiSummary || !session.aiSummaryGeneratedAt) {
      needsUpdate.push(session);
      continue;
    }

    const messagesSinceLastSummary = currentMessageCount - (session.aiSummaryMessageCount || 0);
    const lastSummaryTime = new Date(session.aiSummaryGeneratedAt);
    const minutesSinceLastSummary = (Date.now() - lastSummaryTime.getTime()) / 1000 / 60;

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
 */
export async function getSessionsNeedingKeywordUpdate(
  ctx: SummarizerContext,
  withinHours: number = 24
): Promise<ChatHistoryRecord[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - withinHours);

  const MESSAGE_THRESHOLD = 10;
  const TIME_THROTTLE_MINUTES = 30;

  console.log(`[Keyword Updater] Fetching sessions needing keyword update...`);

  const sessions = await ctx.chatHistories.findRecentByUser(ctx.userId, cutoffTime);

  if (sessions.length === 0) {
    return [];
  }

  const preferences = await getUserPreferences(ctx.userPreferences, ctx.userId);

  const needsUpdate: ChatHistoryRecord[] = [];

  for (const session of sessions) {
    const currentMessageCount = Array.isArray(session.messages)
      ? session.messages.length
      : 0;

    if (currentMessageCount === 0) {
      continue;
    }

    if (!preferences || !preferences.aiSummaryEnabled) {
      continue;
    }

    if (!session.aiKeywordsGeneratedAt) {
      needsUpdate.push(session);
      continue;
    }

    const messagesSinceLastKeywords = currentMessageCount - (session.aiKeywordsMessageCount || 0);
    const lastKeywordsTime = new Date(session.aiKeywordsGeneratedAt);
    const minutesSinceLastKeywords = (Date.now() - lastKeywordsTime.getTime()) / 1000 / 60;

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
 */
export async function getSessionsNeedingTitleUpdate(
  ctx: SummarizerContext,
  withinHours: number = 24
): Promise<ChatHistoryRecord[]> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - withinHours);

  const sessions = await ctx.chatHistories.findRecentByUser(ctx.userId, cutoffTime);

  if (sessions.length === 0) {
    return [];
  }

  const preferences = await getUserPreferences(ctx.userPreferences, ctx.userId);

  const needsUpdate: ChatHistoryRecord[] = [];

  for (const session of sessions) {
    const currentMessageCount = Array.isArray(session.messages)
      ? session.messages.length
      : 0;

    if (currentMessageCount === 0) {
      continue;
    }

    if (!preferences || !preferences.aiTitleEnabled) {
      continue;
    }

    if (session.aiTitle && session.aiTitleGeneratedAt) {
      continue;
    }

    const metadata = session.metadata as any;
    const conversationName = metadata?.conversationName || metadata?.conversation_name;

    if (conversationName || !session.aiTitle) {
      needsUpdate.push(session);
    }
  }

  return needsUpdate;
}

/**
 * Generate and save summary for a single session
 */
export async function updateSessionSummary(
  ctx: SummarizerContext,
  sessionId: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  try {
    const session = await ctx.chatHistories.findById(sessionId, ctx.userId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const messages = Array.isArray(session.messages) ? session.messages : [];
    const messageCount = messages.length;

    if (messageCount === 0) {
      return { success: false, error: 'No messages to summarize' };
    }

    const llmConfig = await getUserLLMConfig(ctx.userPreferences, ctx.apiKeys, ctx.userId);

    const summary = await generateSessionSummary(messages as unknown as Message[], llmConfig);

    const success = await ctx.chatHistories.updateAiSummary(sessionId, summary, messageCount);

    if (!success) {
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
  ctx: SummarizerContext,
  sessionId: string
): Promise<{ success: boolean; keywords?: KeywordClassification; error?: string }> {
  try {
    const session = await ctx.chatHistories.findById(sessionId, ctx.userId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const messages = Array.isArray(session.messages) ? session.messages : [];
    const messageCount = messages.length;

    if (messageCount === 0) {
      return { success: false, error: 'No messages to classify' };
    }

    const llmConfig = await getUserLLMConfig(ctx.userPreferences, ctx.apiKeys, ctx.userId);

    const keywords = await generateKeywordClassification(messages as unknown as Message[], llmConfig);

    const success = await ctx.chatHistories.updateAiKeywords(sessionId, keywords, messageCount);

    if (!success) {
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
  ctx: SummarizerContext,
  sessionId: string
): Promise<{ success: boolean; title?: string; error?: string }> {
  try {
    const session = await ctx.chatHistories.findById(sessionId, ctx.userId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    const messages = Array.isArray(session.messages) ? session.messages : [];

    if (messages.length === 0) {
      return { success: false, error: 'No messages to generate title from' };
    }

    const metadata = session.metadata as any;
    const conversationName = metadata?.conversationName || metadata?.conversation_name;

    let title: string;

    if (conversationName) {
      title = conversationName;
    } else {
      const llmConfig = await getUserLLMConfig(ctx.userPreferences, ctx.apiKeys, ctx.userId);
      title = await generateSessionTitle(messages as unknown as Message[], llmConfig);
    }

    const success = await ctx.chatHistories.updateAiTitle(sessionId, title);

    if (!success) {
      return { success: false, error: 'Failed to save title' };
    }

    return { success: true, title };
  } catch (error) {
    console.error(`Error updating title for session ${sessionId}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Batch update summaries for multiple sessions
 */
export async function batchUpdateSessionSummaries(
  ctx: SummarizerContext,
  sessionIds: string[],
  delayBetweenRequests: number = 100
): Promise<{
  updated: number;
  cached: number;
  errors: number;
  results: any[];
}> {
  const results: any[] = [];

  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];

    if (!sessionId) continue;

    try {
      const result = await updateSessionSummary(ctx, sessionId);
      results.push({ sessionId, ...result });

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
    cached: 0,
    errors: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Batch update keywords for multiple sessions
 */
export async function batchUpdateSessionKeywords(
  ctx: SummarizerContext,
  sessionIds: string[],
  delayBetweenRequests: number = 100
): Promise<{
  updated: number;
  cached: number;
  errors: number;
  results: any[];
}> {
  const results: any[] = [];

  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];

    if (!sessionId) continue;

    try {
      const result = await updateSessionKeywords(ctx, sessionId);
      results.push({ sessionId, ...result });

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
    cached: 0,
    errors: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Batch update titles for multiple sessions
 */
export async function batchUpdateSessionTitles(
  ctx: SummarizerContext,
  sessionIds: string[],
  delayBetweenRequests: number = 100
): Promise<{
  updated: number;
  cached: number;
  errors: number;
  results: any[];
}> {
  const results: any[] = [];

  for (let i = 0; i < sessionIds.length; i++) {
    const sessionId = sessionIds[i];

    if (!sessionId) continue;

    try {
      const result = await updateSessionTitle(ctx, sessionId);
      results.push({ sessionId, ...result });

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
    cached: 0,
    errors: results.filter((r) => !r.success).length,
    results,
  };
}

// ============================================================================
// Entry point functions that create repositories from tokens
// ============================================================================

/**
 * Main function to run periodic summary updates
 */
export async function runPeriodicSummaryUpdate(
  accessToken: string,
  refreshToken: string,
  repositoryFactory: IRepositoryFactory
): Promise<void> {
  console.log('[Summary Updater] Starting periodic summary update...');

  try {
    const { userId, chatHistories, userPreferences, apiKeys } =
      await repositoryFactory.createRepositories(accessToken, refreshToken);

    const ctx: SummarizerContext = { userId, chatHistories, userPreferences, apiKeys };

    const sessions = await getSessionsNeedingSummaryUpdate(ctx);

    if (sessions.length === 0) {
      console.log('[Summary Updater] No sessions need updating');
      return;
    }

    console.log(`[Summary Updater] Found ${sessions.length} sessions needing summary updates`);

    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionSummaries(ctx, sessionIds);

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
 */
export async function runPeriodicKeywordUpdate(
  accessToken: string,
  refreshToken: string,
  repositoryFactory: IRepositoryFactory
): Promise<void> {
  console.log('[Keyword Updater] Starting periodic keyword update...');

  try {
    const { userId, chatHistories, userPreferences, apiKeys } =
      await repositoryFactory.createRepositories(accessToken, refreshToken);

    const ctx: SummarizerContext = { userId, chatHistories, userPreferences, apiKeys };

    const sessions = await getSessionsNeedingKeywordUpdate(ctx);

    if (sessions.length === 0) {
      console.log('[Keyword Updater] No sessions need updating');
      return;
    }

    console.log(`[Keyword Updater] Found ${sessions.length} sessions needing keyword updates`);

    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionKeywords(ctx, sessionIds);

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
 * Main function to run periodic title updates
 */
export async function runPeriodicTitleUpdate(
  accessToken: string,
  refreshToken: string,
  repositoryFactory: IRepositoryFactory
): Promise<void> {
  console.log('[Title Updater] Starting periodic title update...');

  try {
    const { userId, chatHistories, userPreferences, apiKeys } =
      await repositoryFactory.createRepositories(accessToken, refreshToken);

    const ctx: SummarizerContext = { userId, chatHistories, userPreferences, apiKeys };

    const sessions = await getSessionsNeedingTitleUpdate(ctx);

    if (sessions.length === 0) {
      console.log('[Title Updater] No sessions need updating');
      return;
    }

    console.log(`[Title Updater] Found ${sessions.length} sessions needing title updates`);

    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionTitles(ctx, sessionIds);

    console.log('[Title Updater] Update complete:', {
      total: sessionIds.length,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Title Updater] Error during periodic update:', error);
  }
}

// ============================================================================
// ServiceContainer-based entry points (recommended for new code)
// ============================================================================

/**
 * Helper to create SummarizerContext from ServiceContainer
 */
function createContextFromContainer(container: ServiceContainer): SummarizerContext {
  const { chatHistories, userPreferences, apiKeys } = container.getRepositories();
  return {
    userId: container.getUserId(),
    chatHistories,
    userPreferences,
    apiKeys,
  };
}

/**
 * Run summary update using ServiceContainer
 */
export async function runSummaryUpdateWithContainer(
  container: ServiceContainer
): Promise<void> {
  console.log('[Summary Updater] Starting periodic summary update...');

  try {
    const ctx = createContextFromContainer(container);
    const sessions = await getSessionsNeedingSummaryUpdate(ctx);

    if (sessions.length === 0) {
      console.log('[Summary Updater] No sessions need updating');
      return;
    }

    console.log(`[Summary Updater] Found ${sessions.length} sessions needing summary updates`);

    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionSummaries(ctx, sessionIds);

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
 * Run keyword update using ServiceContainer
 */
export async function runKeywordUpdateWithContainer(
  container: ServiceContainer
): Promise<void> {
  console.log('[Keyword Updater] Starting periodic keyword update...');

  try {
    const ctx = createContextFromContainer(container);
    const sessions = await getSessionsNeedingKeywordUpdate(ctx);

    if (sessions.length === 0) {
      console.log('[Keyword Updater] No sessions need updating');
      return;
    }

    console.log(`[Keyword Updater] Found ${sessions.length} sessions needing keyword updates`);

    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionKeywords(ctx, sessionIds);

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
 * Run title update using ServiceContainer
 */
export async function runTitleUpdateWithContainer(
  container: ServiceContainer
): Promise<void> {
  console.log('[Title Updater] Starting periodic title update...');

  try {
    const ctx = createContextFromContainer(container);
    const sessions = await getSessionsNeedingTitleUpdate(ctx);

    if (sessions.length === 0) {
      console.log('[Title Updater] No sessions need updating');
      return;
    }

    console.log(`[Title Updater] Found ${sessions.length} sessions needing title updates`);

    const sessionIds = sessions.map((s) => s.id);
    const result = await batchUpdateSessionTitles(ctx, sessionIds);

    console.log('[Title Updater] Update complete:', {
      total: sessionIds.length,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Title Updater] Error during periodic update:', error);
  }
}
