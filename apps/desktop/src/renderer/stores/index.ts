/**
 * Store exports
 *
 * Provides singleton instances for dependency injection.
 * Swap MockAgentStore for real implementation when ready.
 */

export type { IAgentStore, AgentChangeListener, AllAgentsChangeListener } from './IAgentStore';
export type { IForkStore, ForkDragState, ForkResult, ForkStateListener } from './IForkStore';
export { MockAgentStore } from './MockAgentStore';
export { ForkStore } from './ForkStore';

import type { IAgentStore } from './IAgentStore';
import type { IForkStore } from './IForkStore';
import { MockAgentStore } from './MockAgentStore';
import { ForkStore } from './ForkStore';

/**
 * Singleton agent store instance
 * Currently uses mock data, can be swapped for real implementation
 */
export const agentStore: IAgentStore = new MockAgentStore();

/**
 * Singleton fork store instance
 * Manages fork drag state
 */
export const forkStore: IForkStore = new ForkStore();
