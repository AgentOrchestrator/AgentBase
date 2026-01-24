/**
 * Orchestrator Pill Types
 *
 * Types for the orchestrator meta-agent UI state.
 */

/**
 * Tool call made during assistant response
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

/**
 * A message in an orchestrator conversation
 */
export interface OrchestratorMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

/**
 * A conversation with the orchestrator
 */
export interface OrchestratorConversation {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Health status of the orchestrator
 */
export interface OrchestratorHealth {
  cliAvailable: boolean;
  lastHealthCheck: number;
}

/**
 * Response from sending a message
 */
export interface OrchestratorResponse {
  content: string;
  toolCalls?: ToolCall[];
}

/**
 * Orchestrator Pill Store State
 */
export interface OrchestratorPillState {
  // State
  conversationId: string | null;
  messages: OrchestratorMessage[];
  inputValue: string;
  isSending: boolean;
  streamingContent: string;
  health: OrchestratorHealth | null;

  // Actions
  initialize(): Promise<void>;
  sendMessage(): Promise<void>;
  setInputValue(value: string): void;
  reset(): void;
}

/**
 * Orchestrator API exposed to renderer via preload
 */
export interface OrchestratorAPI {
  getHealth(): Promise<OrchestratorHealth>;
  createConversation(): Promise<OrchestratorConversation>;
  getMessages(conversationId: string): Promise<OrchestratorMessage[]>;
  getMostRecentConversation(): Promise<OrchestratorConversation | null>;
  sendMessage(
    conversationId: string,
    message: string,
    onChunk: (chunk: string) => void
  ): Promise<OrchestratorResponse>;
}
