import type { CodingAgentType } from './agent.types';
import type { ChatMessage } from './message.types';

/**
 * Session identifier - supports ID, name, or "latest" lookup
 */
export type SessionIdentifier =
  | { type: 'id'; value: string }
  | { type: 'name'; value: string }
  | { type: 'latest' };

/**
 * Session metadata (without full message history)
 */
export interface SessionInfo {
  id: string;
  name?: string;
  agentType: CodingAgentType;
  createdAt: string;
  updatedAt: string;
  projectPath?: string;
  messageCount: number;
  /** For forked sessions, the parent session ID */
  parentSessionId?: string;
}

/**
 * Full session content including messages
 */
export interface SessionContent extends SessionInfo {
  messages: ChatMessage[];
}

/**
 * Filter options for listing sessions
 */
export interface SessionFilter {
  projectPath?: string;
  afterDate?: Date;
  beforeDate?: Date;
  limit?: number;
}

/**
 * Options for continuing a session
 */
export interface ContinueOptions {
  workingDirectory?: string;
  timeout?: number;
}

/**
 * Options for forking a session
 */
export interface ForkOptions {
  /** Human-readable name for the new session */
  newSessionName?: string;
  /** Custom session ID (auto-generated if not provided) */
  customSessionId?: string;
}

/**
 * Helper to create a session identifier by ID
 */
export function sessionById(id: string): SessionIdentifier {
  return { type: 'id', value: id };
}

/**
 * Helper to create a session identifier by name
 */
export function sessionByName(name: string): SessionIdentifier {
  return { type: 'name', value: name };
}

/**
 * Helper to get the latest session
 */
export function latestSession(): SessionIdentifier {
  return { type: 'latest' };
}
