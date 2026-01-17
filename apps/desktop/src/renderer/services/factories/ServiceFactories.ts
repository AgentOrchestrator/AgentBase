/**
 * Service Factories
 *
 * Factory functions for creating real service implementations.
 * Use these in production, swap with MockServiceFactories for testing.
 */

import type { AgentType } from '../../../../types/coding-agent-status';
import type { ServiceFactories } from '../../context/NodeServicesRegistry';
import type { ITerminalService } from '../../context/node-services';
import { TerminalServiceImpl } from '../impl/TerminalServiceImpl';
import { WorkspaceServiceImpl } from '../impl/WorkspaceServiceImpl';
import { AgentServiceImpl } from '../impl/AgentServiceImpl';
import { ConversationServiceImpl } from '../impl/ConversationServiceImpl';
import { createCodingAgentAdapter } from '../coding-agent-adapters';

/**
 * Create production service factories
 */
export function createServiceFactories(): ServiceFactories {
  return {
    createTerminalService: (nodeId: string, terminalId: string) => {
      return new TerminalServiceImpl(nodeId, terminalId);
    },

    createWorkspaceService: (nodeId: string, workspacePath?: string) => {
      return new WorkspaceServiceImpl(nodeId, workspacePath);
    },

    createAgentService: (
      nodeId: string,
      agentId: string,
      agentType: AgentType,
      terminalService: ITerminalService
    ) => {
      // Create stateless adapter based on agent type
      // The adapter factory may return null for unsupported types or if API is unavailable
      let adapter = null;
      try {
        adapter = createCodingAgentAdapter(agentType);
      } catch (error) {
        // Adapter creation failed (unsupported type or API unavailable)
        // AgentServiceImpl handles null adapter gracefully
        console.warn('[ServiceFactories] Failed to create adapter:', error);
      }
      return new AgentServiceImpl(nodeId, agentId, agentType, terminalService, adapter);
    },

    createConversationService: (
      nodeId: string,
      sessionId: string,
      agentType: string
    ) => {
      return new ConversationServiceImpl(nodeId, sessionId, agentType);
    },
  };
}
