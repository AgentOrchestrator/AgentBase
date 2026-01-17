/**
 * Node Services Module
 *
 * Re-exports all node service types and interfaces.
 */

// Coding Agent Adapter types
export type {
  AgentAdapterEvent,
  AgentAdapterEventType,
  AgentError,
  AgentErrorCode,
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
} from './coding-agent-adapter';
// Result helpers
export { agentError, err, ok } from './coding-agent-adapter';
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
