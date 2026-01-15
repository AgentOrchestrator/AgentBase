/**
 * Store exports
 *
 * Provides singleton instances for dependency injection.
 * Swap MockAgentStore for real implementation when ready.
 */

export type { IAgentStore, AgentChangeListener, AllAgentsChangeListener } from './IAgentStore';
export type { IForkStore, ForkDragState, ForkResult, ForkStateListener } from './IForkStore';
export type { INodeStore, NodesChangeListener } from './INodeStore';
export type { AgentActionListener, AllAgentActionsListener } from './AgentActionStore';
export type {
  ILinearStore,
  LinearState,
  LinearStateListener,
  LinearFilterState,
  LinearIssue,
  LinearProject,
  LinearMilestone,
  LinearWorkflowState,
  MilestoneOption,
} from './ILinearStore';
export { MockAgentStore } from './MockAgentStore';
export { ForkStore } from './ForkStore';
export { NodeStore } from './NodeStore';
export { AgentActionStore } from './AgentActionStore';
export { LinearStore } from './LinearStore';

import type { IAgentStore } from './IAgentStore';
import type { IForkStore } from './IForkStore';
import type { INodeStore } from './INodeStore';
import type { ILinearStore } from './ILinearStore';
import { MockAgentStore } from './MockAgentStore';
import { ForkStore } from './ForkStore';
import { NodeStore } from './NodeStore';
import { AgentActionStore } from './AgentActionStore';
import { LinearStore } from './LinearStore';

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
 * Singleton node store instance
 * Manages canvas node state
 */
export const nodeStore: INodeStore = new NodeStore();

/**
 * Singleton action store instance
 * Tracks hook-driven actions per agent
 */
export const agentActionStore = new AgentActionStore();

/**
 * Singleton Linear store instance
 * Manages Linear integration state
 */
export const linearStore: ILinearStore = new LinearStore();
