/**
 * Node Services Module
 *
 * Re-exports all node service types and interfaces.
 */

// Core interfaces
export type {
  NodeType,
  INodeService,
  ITerminalService,
  IWorkspaceService,
  IAgentService,
  GitInfo,
} from './types';

// Discriminated union types
export type {
  TerminalNodeServices,
  AgentNodeServices,
  WorkspaceNodeServices,
  CustomNodeServices,
  NodeServices,
} from './node-services.types';

// Type guards
export {
  isTerminalNodeServices,
  isAgentNodeServices,
  isWorkspaceNodeServices,
  isCustomNodeServices,
  hasTerminalService,
  hasWorkspaceService,
  hasAgentService,
} from './node-services.types';
