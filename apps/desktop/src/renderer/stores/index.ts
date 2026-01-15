/**
 * Store exports
 *
 * Provides singleton instances for dependency injection.
 * Swap MockAgentStore for real implementation when ready.
 */

export type { IAgentStore, AgentChangeListener, AllAgentsChangeListener } from './IAgentStore';
export type { IForkStore, ForkDragState, ForkResult, ForkStateListener } from './IForkStore';
export type { AgentActionListener, AllAgentActionsListener } from './AgentActionStore';
export { MockAgentStore } from './MockAgentStore';
export { ForkStore } from './ForkStore';
export { AgentActionStore } from './AgentActionStore';

import type { IAgentStore } from './IAgentStore';
import type { IForkStore } from './IForkStore';
import { MockAgentStore } from './MockAgentStore';
import { ForkStore } from './ForkStore';
import { AgentActionStore } from './AgentActionStore';

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

/**
 * Singleton action store instance
 * Tracks hook-driven actions per agent
 */
export const agentActionStore = new AgentActionStore();
