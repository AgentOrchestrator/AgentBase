/**
 * StatusServiceStub
 *
 * Stub implementation of IStatusService that wraps IAgentService.
 * Provides passthrough status access - can be expanded with computed status logic later.
 */

import type { IStatusService } from './IStatusService';
import type { IAgentService } from '../../context/node-services/types';
import type {
  CodingAgentStatusInfo,
  StatusChangeListener,
} from '../../../../types/coding-agent-status';

/**
 * Stub implementation that delegates to IAgentService.
 * Future implementations can add computed status logic (e.g., derived states,
 * aggregated progress, estimated completion time).
 */
export class StatusServiceStub implements IStatusService {
  constructor(private readonly agentService: IAgentService) {}

  getStatus(_agentId: string): CodingAgentStatusInfo | null {
    return this.agentService.getStatus();
  }

  onStatusChange(listener: StatusChangeListener): () => void {
    return this.agentService.onStatusChange(listener);
  }
}

/**
 * Factory function for creating StatusServiceStub instances.
 * @param agentService - The agent service to wrap
 */
export function createStatusService(agentService: IAgentService): IStatusService {
  return new StatusServiceStub(agentService);
}
