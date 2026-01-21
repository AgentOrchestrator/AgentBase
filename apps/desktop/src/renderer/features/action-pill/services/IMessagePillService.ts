/**
 * MessagePill Service Interface
 *
 * Defines the contract for the message pill service.
 */

export interface SendMessageOptions {
  /** The agent ID to send to */
  agentId: string;
  /** The agent type (e.g., 'claude_code') */
  agentType: string;
  /** The session ID */
  sessionId: string;
  /** The workspace path */
  workspacePath: string;
}

export interface SendMessageResult {
  success: boolean;
  error?: string;
}

export interface IMessagePillService {
  /**
   * Send a message to an agent's session
   */
  sendMessage(message: string, options: SendMessageOptions): Promise<SendMessageResult>;

  /**
   * Get agent info by agent ID from the node store
   */
  getAgentInfo(agentId: string): SendMessageOptions | null;
}
