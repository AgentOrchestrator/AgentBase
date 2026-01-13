/**
 * Store exports
 *
 * Provides singleton instances for dependency injection.
 * Swap MockAgentStore for real implementation when ready.
 */

export type { IAgentStore, AgentChangeListener, AllAgentsChangeListener } from './IAgentStore';
export { MockAgentStore } from './MockAgentStore';

import type { IAgentStore } from './IAgentStore';
import { MockAgentStore } from './MockAgentStore';

/**
 * Singleton agent store instance
 * Currently uses mock data, can be swapped for real implementation
 */
export const agentStore: IAgentStore = new MockAgentStore();
