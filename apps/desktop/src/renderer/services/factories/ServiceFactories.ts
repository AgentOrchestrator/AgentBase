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
      return new AgentServiceImpl(nodeId, agentId, agentType, terminalService, adapter);
    },

    createConversationService: (nodeId: string, sessionId: string, agentType: string) => {
      return new ConversationServiceImpl(nodeId, sessionId, agentType);
    },
  };
}
