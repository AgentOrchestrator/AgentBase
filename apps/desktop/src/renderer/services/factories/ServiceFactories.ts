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
      terminalService: ITerminalService,
      workspacePath?: string
    ) => {
      return new AgentServiceImpl(nodeId, agentId, agentType, terminalService, workspacePath);
    },
  };
}
