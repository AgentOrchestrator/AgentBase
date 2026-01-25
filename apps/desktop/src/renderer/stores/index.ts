/**
 * Store exports
 *
 * Provides singleton instances for dependency injection.
 *
 * Note: AgentActionStore has been replaced by the Zustand-based store
 * in features/action-pill. Use useActionPillStore from there instead.
 */

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
export type { AllModeChangeListener, PermissionModeListener } from './PermissionModeStore';
export { PermissionModeStore } from './PermissionModeStore';

import { ForkStore } from './ForkStore';
import type { IForkStore } from './IForkStore';
import type { ILinearStore } from './ILinearStore';
import type { INodeStore } from './INodeStore';
import { LinearStore } from './LinearStore';
import { NodeStore } from './NodeStore';
import { PermissionModeStore } from './PermissionModeStore';

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
 * Singleton Linear store instance
 * Manages Linear integration state
 */
export const linearStore: ILinearStore = new LinearStore();

/**
 * Singleton permission mode store instance
 * Manages permission mode cycling (Plan/Auto-Accept/Ask)
 */
export const permissionModeStore = new PermissionModeStore();
