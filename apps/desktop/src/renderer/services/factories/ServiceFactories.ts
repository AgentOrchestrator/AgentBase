/**
 * Service Factories
 *
 * Factory functions for creating service implementations.
 */

import type { AgentType } from '../../../../types/coding-agent-status';
import type { ServiceFactories } from '../../context/NodeServicesRegistry';
import type { ITerminalService } from '../../context/node-services';
import { createCodingAgentAdapter } from '../coding-agent-adapters';
import { AgentServiceImpl } from '../impl/AgentServiceImpl';
import { ConversationServiceImpl } from '../impl/ConversationServiceImpl';
import { TerminalServiceImpl } from '../impl/TerminalServiceImpl';
import { WorkspaceServiceImpl } from '../impl/WorkspaceServiceImpl';
import { useActionFlowLogger } from '../../features/action-pill/store/actionFlowLogger';

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
      // Adapter is required for agent to function - throw if creation fails
      const adapter = createCodingAgentAdapter(agentType);
      const service = new AgentServiceImpl(nodeId, agentId, agentType, terminalService, adapter);

      // Log agent service creation
      console.log('[ServiceFactories] Creating agent service with agentId:', agentId, 'nodeId:', nodeId);
      try {
        useActionFlowLogger.getState().addLog(
          'Agent Service Created',
          `Agent service created for node "${nodeId}" with agentId: ${agentId}`,
          'success',
          {
            agentId,
            nodeId,
            details: {
              agentType,
              terminalId: terminalService.terminalId,
            },
          }
        );
        console.log('[ServiceFactories] Logged agent service creation successfully');
      } catch (err) {
        console.error('[ServiceFactories] Failed to log agent service creation:', err);
      }

      return service;
    },

    createConversationService: (nodeId: string, sessionId: string, agentType: string) => {
      return new ConversationServiceImpl(nodeId, sessionId, agentType);
    },
  };
}
