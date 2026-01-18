/**
 * Conversation Service Interface
 *
 * Manages session data loading for ConversationNode.
 * Each service instance is lifecycle-scoped to its node.
 */

import type { CodingAgentMessage } from '@agent-orchestrator/shared';
import type { INodeService } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Renderer-specific session content with CodingAgentMessage format.
 *
 * Note: This differs from the shared SessionContent which uses ChatMessage[]
 * and has metadata in a nested object. This flat structure with CodingAgentMessage
 * is specific to the desktop renderer's needs.
 */
export interface RendererSessionContent {
  id: string;
  messages: CodingAgentMessage[];
  messageCount: number;
  projectPath?: string;
  projectName?: string;
}

/**
 * Filter options for loading sessions
 */
export interface SessionFilter {
  roles?: Array<'user' | 'assistant' | 'system'>;
}

/**
 * Callback for messages loaded event
 */
export type MessagesLoadedListener = (messages: CodingAgentMessage[]) => void;

/**
 * Callback for error event
 */
export type ErrorListener = (error: string) => void;

// =============================================================================
// Conversation Service Interface
// =============================================================================

/**
 * Conversation service - manages session data loading.
 * Wraps codingAgentAPI for session fetching with proper lifecycle.
 */
export interface IConversationService extends INodeService {
  /** Session identifier to load */
  readonly sessionId: string;

  /** Agent type (e.g., 'claude_code') */
  readonly agentType: string;

  // Session loading
  /**
   * Load session messages with optional filter.
   * Notifies subscribers when complete.
   */
  loadSession(filter?: SessionFilter): Promise<void>;

  /**
   * Get currently loaded messages.
   * Returns empty array if not loaded.
   */
  getMessages(): CodingAgentMessage[];

  /**
   * Check if session is currently loading.
   */
  isLoading(): boolean;

  /**
   * Get current error message, if any.
   */
  getError(): string | null;

  // Subscriptions
  /**
   * Subscribe to messages loaded event.
   * @returns Unsubscribe function
   */
  onMessagesLoaded(listener: MessagesLoadedListener): () => void;

  /**
   * Subscribe to error events.
   * @returns Unsubscribe function
   */
  onError(listener: ErrorListener): () => void;

  // Refresh
  /**
   * Reload the session (clears cache and fetches fresh data).
   */
  refresh(): Promise<void>;
}
