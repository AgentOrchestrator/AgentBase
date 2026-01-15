/**
 * ConversationServiceImpl
 *
 * Implementation of IConversationService that wraps codingAgentAPI.
 * Manages session data loading with proper lifecycle.
 */

import type {
  IConversationService,
  SessionContent,
  SessionFilter,
  MessagesLoadedListener,
  ErrorListener,
} from '../../context/node-services';
import type { CodingAgentAPI, CodingAgentType } from '../../../main/services/coding-agent';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';

/**
 * Conversation service implementation using codingAgentAPI
 */
export class ConversationServiceImpl implements IConversationService {
  readonly nodeId: string;
  readonly sessionId: string;
  readonly agentType: string;

  private _messages: CodingAgentMessage[] = [];
  private _isLoading = false;
  private _error: string | null = null;

  private messagesListeners = new Set<MessagesLoadedListener>();
  private errorListeners = new Set<ErrorListener>();

  constructor(nodeId: string, sessionId: string, agentType: string) {
    this.nodeId = nodeId;
    this.sessionId = sessionId;
    this.agentType = agentType;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // No auto-loading on init - will load on demand when expanded
    console.log(`[ConversationService] Initialized for session ${this.sessionId}`);
  }

  /**
   * Load session messages with optional filter
   */
  async loadSession(filter?: SessionFilter): Promise<void> {
    // Skip if already loading
    if (this._isLoading) {
      return;
    }

    // Get codingAgentAPI
    const codingAgentAPI = (window as unknown as { codingAgentAPI?: CodingAgentAPI }).codingAgentAPI;

    if (!codingAgentAPI) {
      const error = 'Coding agent API not available';
      this._error = error;
      this.notifyError(error);
      return;
    }

    this._isLoading = true;
    this._error = null;

    try {
      const session = await codingAgentAPI.getSession(
        this.agentType as CodingAgentType,
        this.sessionId,
        filter ? { roles: filter.roles } : undefined
      );

      if (session) {
        // Filter to only text messages (skip tool calls)
        const textMessages = session.messages.filter(
          (m: CodingAgentMessage) =>
            m.messageType === 'assistant' ||
            m.messageType === 'user' ||
            !m.messageType
        );
        this._messages = textMessages;
        this.notifyMessagesLoaded(textMessages);
      } else {
        const error = 'Session not found';
        this._error = error;
        this.notifyError(error);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to load conversation';
      this._error = error;
      this.notifyError(error);
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Get currently loaded messages
   */
  getMessages(): CodingAgentMessage[] {
    return this._messages;
  }

  /**
   * Check if session is currently loading
   */
  isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Get current error message
   */
  getError(): string | null {
    return this._error;
  }

  /**
   * Subscribe to messages loaded event
   */
  onMessagesLoaded(listener: MessagesLoadedListener): () => void {
    this.messagesListeners.add(listener);
    return () => {
      this.messagesListeners.delete(listener);
    };
  }

  /**
   * Subscribe to error events
   */
  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Reload the session (clears cache and fetches fresh data)
   */
  async refresh(): Promise<void> {
    this._messages = [];
    this._error = null;
    await this.loadSession({ roles: ['user', 'assistant'] });
  }

  /**
   * Dispose the service - cleanup resources
   */
  async dispose(): Promise<void> {
    console.log(`[ConversationService] Disposed for session ${this.sessionId}`);
    this._messages = [];
    this._error = null;
    this.messagesListeners.clear();
    this.errorListeners.clear();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private notifyMessagesLoaded(messages: CodingAgentMessage[]): void {
    this.messagesListeners.forEach((listener) => {
      try {
        listener(messages);
      } catch (err) {
        console.error('[ConversationService] Error in messages listener:', err);
      }
    });
  }

  private notifyError(error: string): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error('[ConversationService] Error in error listener:', err);
      }
    });
  }
}
