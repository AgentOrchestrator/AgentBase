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

// Conversation service
export type {
  IConversationService,
  ChatMessage,
  SessionContent,
  SessionFilter,
  MessagesLoadedListener,
  ErrorListener,
} from './IConversationService';

// Discriminated union types
export type {
  TerminalNodeServices,
  AgentNodeServices,
  WorkspaceNodeServices,
  CustomNodeServices,
  ConversationNodeServices,
  NodeServices,
} from './node-services.types';

// Type guards
export {
  isTerminalNodeServices,
  isAgentNodeServices,
  isWorkspaceNodeServices,
  isCustomNodeServices,
  isConversationNodeServices,
  hasTerminalService,
  hasWorkspaceService,
  hasAgentService,
  hasConversationService,
} from './node-services.types';
