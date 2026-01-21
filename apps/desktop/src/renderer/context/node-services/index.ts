/**
 * Node Services Module
 *
 * Re-exports all node service types and interfaces.
 */

// Coding Agent Adapter types - re-exported from new module location
export type {
  AgentAdapterEvent,
  AgentAdapterEventType,
  AgentError,
  AgentEventHandler,
  CodingAgentMessage,
  CodingAgentSessionContent,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  ICodingAgentAdapter,
  MessageFilterOptions,
  PermissionRequestPayload,
  PermissionResponsePayload,
  Result,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionPayload,
  SessionSummary,
  StatusPayload,
  StreamCallback,
} from '../../services/coding-agent';
// Result helpers and enum
export { AgentErrorCode, agentError, err, ok } from '../../services/coding-agent';
// Conversation service
export type {
  ErrorListener,
  IConversationService,
  MessagesLoadedListener,
  RendererSessionContent,
  SessionFilter,
} from './IConversationService';
// Discriminated union types
export type {
  AgentNodeServices,
  ConversationNodeServices,
  CustomNodeServices,
  NodeServices,
  TerminalNodeServices,
} from './node-services.types';
// Type guards
export {
  hasAgentService,
  hasConversationService,
  hasTerminalService,
  hasWorkspaceService,
  isAgentNodeServices,
  isConversationNodeServices,
  isCustomNodeServices,
  isTerminalNodeServices,
} from './node-services.types';
// Core interfaces
export type {
  GitInfo,
  IAgentService,
  INodeService,
  ITerminalService,
  IWorkspaceService,
  NodeType,
} from './types';
