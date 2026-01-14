/**
 * Node Services Discriminated Union Types
 *
 * Type-safe service bundles per node type using discriminated unions.
 * Enables compile-time checking that nodes only access appropriate services.
 */

import type {
  ITerminalService,
  IWorkspaceService,
  IAgentService,
} from './types';
import type { IConversationService } from './IConversationService';

// =============================================================================
// Service Bundles (Discriminated Unions)
// =============================================================================

/**
 * Services available to TerminalNode
 */
export interface TerminalNodeServices {
  readonly type: 'terminal';
  readonly terminal: ITerminalService;
  readonly workspace: IWorkspaceService;
}

/**
 * Services available to AgentNode
 */
export interface AgentNodeServices {
  readonly type: 'agent';
  readonly agent: IAgentService;
  readonly terminal: ITerminalService;
  readonly workspace: IWorkspaceService;
}

/**
 * Services available to WorkspaceNode
 */
export interface WorkspaceNodeServices {
  readonly type: 'workspace';
  readonly workspace: IWorkspaceService;
}

/**
 * Services available to CustomNode (minimal, extensible)
 */
export interface CustomNodeServices {
  readonly type: 'custom';
}

/**
 * Services available to ConversationNode
 */
export interface ConversationNodeServices {
  readonly type: 'conversation';
  readonly conversation: IConversationService;
}

/**
 * Discriminated union of all node service types
 */
export type NodeServices =
  | TerminalNodeServices
  | AgentNodeServices
  | WorkspaceNodeServices
  | CustomNodeServices
  | ConversationNodeServices;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for TerminalNodeServices
 */
export function isTerminalNodeServices(
  services: NodeServices
): services is TerminalNodeServices {
  return services.type === 'terminal';
}

/**
 * Type guard for AgentNodeServices
 */
export function isAgentNodeServices(
  services: NodeServices
): services is AgentNodeServices {
  return services.type === 'agent';
}

/**
 * Type guard for WorkspaceNodeServices
 */
export function isWorkspaceNodeServices(
  services: NodeServices
): services is WorkspaceNodeServices {
  return services.type === 'workspace';
}

/**
 * Type guard for CustomNodeServices
 */
export function isCustomNodeServices(
  services: NodeServices
): services is CustomNodeServices {
  return services.type === 'custom';
}

/**
 * Type guard for ConversationNodeServices
 */
export function isConversationNodeServices(
  services: NodeServices
): services is ConversationNodeServices {
  return services.type === 'conversation';
}

// =============================================================================
// Service Availability Helpers
// =============================================================================

/**
 * Check if services bundle has terminal service
 */
export function hasTerminalService(
  services: NodeServices
): services is TerminalNodeServices | AgentNodeServices {
  return services.type === 'terminal' || services.type === 'agent';
}

/**
 * Check if services bundle has workspace service
 */
export function hasWorkspaceService(
  services: NodeServices
): services is TerminalNodeServices | AgentNodeServices | WorkspaceNodeServices {
  return (
    services.type === 'terminal' ||
    services.type === 'agent' ||
    services.type === 'workspace'
  );
}

/**
 * Check if services bundle has agent service
 */
export function hasAgentService(
  services: NodeServices
): services is AgentNodeServices {
  return services.type === 'agent';
}

/**
 * Check if services bundle has conversation service
 */
export function hasConversationService(
  services: NodeServices
): services is ConversationNodeServices {
  return services.type === 'conversation';
}
