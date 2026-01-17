/**
 * Store exports
 *
 * Provides singleton instances for dependency injection.
 */

export type { AgentActionListener, AllAgentActionsListener } from './AgentActionStore';
export { AgentActionStore } from './AgentActionStore';
export { ForkStore } from './ForkStore';
export type { AgentChangeListener, AllAgentsChangeListener, IAgentStore } from './IAgentStore';
export type { ForkDragState, ForkResult, ForkStateListener, IForkStore } from './IForkStore';
export type {
  ILinearStore,
  LinearFilterState,
  LinearIssue,
  LinearMilestone,
  LinearProject,
  LinearState,
  LinearStateListener,
  LinearWorkflowState,
  MilestoneOption,
} from './ILinearStore';
export type { INodeStore, NodesChangeListener } from './INodeStore';
export { LinearStore } from './LinearStore';
export { NodeStore } from './NodeStore';

import { AgentActionStore } from './AgentActionStore';
import { ForkStore } from './ForkStore';
import type { IForkStore } from './IForkStore';
import type { ILinearStore } from './ILinearStore';
import type { INodeStore } from './INodeStore';
import { LinearStore } from './LinearStore';
import { NodeStore } from './NodeStore';

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
