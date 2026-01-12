/**
 * Chat message in a session
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request to generate a response
 */
export interface GenerateRequest {
  /** The prompt to send to the agent */
  prompt: string;
  /** Working directory for the agent (affects file access) */
  workingDirectory?: string;
  /** Custom system prompt to prepend */
  systemPrompt?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Response from a generation request
 */
export interface GenerateResponse {
  /** The generated content */
  content: string;
  /** Session ID (for stateful agents) */
  sessionId?: string;
  /** Unique message ID */
  messageId: string;
  /** When the response was generated */
  timestamp: string;
  /** Token usage if available */
  tokensUsed?: number;
}

/**
 * Callback for streaming output chunks
 */
export type StreamCallback = (chunk: string) => void;
