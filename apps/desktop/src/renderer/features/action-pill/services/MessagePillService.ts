/**
 * MessagePill Service Implementation
 *
 * Handles business logic for sending messages to agents.
 * Integrates with codingAgentAPI for session continuation.
 */

import type { Node } from '@xyflow/react';
import type { CodingAgentType } from '../../../../main/services/coding-agent/types/agent.types';
import { nodeStore } from '../../../stores';
import { useMessagePillStore } from '../store/messagePillStore';
import type {
  IMessagePillService,
  SendMessageOptions,
  SendMessageResult,
} from './IMessagePillService';

interface AgentNodeData extends Record<string, unknown> {
  agentId?: string;
  agentType?: string;
  sessionId?: string;
  workspacePath?: string;
}

/**
 * MessagePillService implementation
 */
class MessagePillServiceImpl implements IMessagePillService {
  async sendMessage(message: string, options: SendMessageOptions): Promise<SendMessageResult> {
    const store = useMessagePillStore.getState();

    if (!message.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }

    store.setSending(true);

    try {
      if (!window.codingAgentAPI?.continueSessionStreaming) {
        console.warn('[MessagePillService] codingAgentAPI.continueSessionStreaming not available');
        return { success: false, error: 'Agent API not available' };
      }

      await window.codingAgentAPI.continueSessionStreaming(
        options.agentType as CodingAgentType,
        { type: 'id', value: options.sessionId },
        message,
        (chunk) => {
          // Stream callback - could be used for UI updates if needed
          console.log('[MessagePillService] Stream chunk:', chunk);
        },
        { workingDirectory: options.workspacePath, agentId: options.agentId }
      );

      // Add to history
      store.addToHistory({
        id: `msg-${Date.now()}`,
        content: message,
        targetAgentId: options.agentId,
        timestamp: Date.now(),
      });

      store.clearInput();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MessagePillService] Error sending message:', error);
      return { success: false, error: errorMessage };
    } finally {
      store.setSending(false);
    }
  }

  getAgentInfo(agentId: string): SendMessageOptions | null {
    const nodes = nodeStore.getAllNodes() as Node<AgentNodeData>[];
    const agentNode = nodes.find((node) => node.type === 'agent' && node.data?.agentId === agentId);

    if (!agentNode) {
      return null;
    }

    const data = agentNode.data;

    if (!data.sessionId || !data.workspacePath) {
      return null;
    }

    return {
      agentId: data.agentId || agentId,
      agentType: data.agentType || 'claude_code',
      sessionId: data.sessionId,
      workspacePath: data.workspacePath,
    };
  }
}

/**
 * Singleton service instance
 */
export const messagePillService: IMessagePillService = new MessagePillServiceImpl();
