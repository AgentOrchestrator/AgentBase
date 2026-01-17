/**
 * Session Provider
 *
 * Abstraction for retrieving active coding agent sessions.
 * Uses file system lookups via the main process to find session files.
 */

import type { CodingAgentType } from '../../main/services/coding-agent';
import type { AgentType } from '@agent-orchestrator/shared';

/**
 * Session information returned by the provider
 */
export interface SessionInfo {
  /** Session identifier */
  id: string;
  /** When the session was last updated */
  updatedAt: string;
}

/**
 * Supported agent types for session provider
 * Maps to CodingAgentType internally
 */
const SUPPORTED_AGENT_TYPES: CodingAgentType[] = ['claude_code', 'cursor', 'codex'];

/**
 * Check if an agent type supports session operations
 */
function isSupportedAgentType(agentType: AgentType): agentType is CodingAgentType {
  return SUPPORTED_AGENT_TYPES.includes(agentType as CodingAgentType);
}

/**
 * Callback for session start events
 */
export type SessionStartCallback = (
  sessionId: string,
  workspacePath: string,
  agentType: AgentType
) => void;

/**
 * Interface for session providers
 */
export interface ISessionProvider {
  /**
   * Get the active session for a workspace path
   * @param agentType - Type of agent (only claude_code, cursor, codex supported)
   * @param workspacePath - Workspace/project path
   * @returns Session info or null if no active session or unsupported agent
   */
  getActiveSession(
    agentType: AgentType,
    workspacePath: string
  ): Promise<SessionInfo | null>;

  /**
   * Subscribe to session start events (optional)
   * Only implemented by hooks-based provider
   * @param callback - Called when a session starts
   * @returns Unsubscribe function
   */
  onSessionStart?(callback: SessionStartCallback): () => void;
}

/**
 * File-based session provider implementation
 *
 * Retrieves session information by scanning the agent's session
 * history files on disk. For Claude Code, this reads from
 * ~/.claude/projects/<encoded-path>/<session-id>.jsonl
 */
export class FileBasedSessionProvider implements ISessionProvider {
  /**
   * Get the most recent session for a workspace by scanning session files
   */
  async getActiveSession(
    agentType: AgentType,
    workspacePath: string
  ): Promise<SessionInfo | null> {
    // Only supported agent types can have sessions
    if (!isSupportedAgentType(agentType)) {
      console.log('[FileBasedSessionProvider] Agent type not supported for sessions:', agentType);
      return null;
    }

    if (!window.codingAgentAPI?.getLatestSession) {
      console.warn('[FileBasedSessionProvider] getLatestSession API not available');
      return null;
    }

    try {
      const result = await window.codingAgentAPI.getLatestSession(agentType, workspacePath);
      if (result) {
        console.log('[FileBasedSessionProvider] Found session:', {
          workspacePath,
          sessionId: result.id,
        });
      }
      return result;
    } catch (error) {
      console.error('[FileBasedSessionProvider] Failed to get session:', error);
      return null;
    }
  }

  // Note: onSessionStart is not implemented for file-based provider
  // since it doesn't have real-time event capabilities
}

/**
 * Singleton instance
 */
export const sessionProvider: ISessionProvider = new FileBasedSessionProvider();
