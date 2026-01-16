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
  RendererSessionContent,
  SessionFilter,
  MessagesLoadedListener,
  ErrorListener,
} from './IConversationService';

// Discriminated union types
export type {
  TerminalNodeServices,
  AgentNodeServices,
  CustomNodeServices,
  ConversationNodeServices,
  NodeServices,
} from './node-services.types';

// Type guards
export {
  isTerminalNodeServices,
  isAgentNodeServices,
  isCustomNodeServices,
  isConversationNodeServices,
  hasTerminalService,
  hasWorkspaceService,
  hasAgentService,
  hasConversationService,
} from './node-services.types';

// Coding Agent Adapter types
export type {
  ICodingAgentAdapter,
  AgentAdapterEvent,
  AgentAdapterEventType,
  AgentEventHandler,
  PermissionRequestPayload,
  PermissionResponsePayload,
  SessionPayload,
  StatusPayload,
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  CodingAgentSessionContent,
  CodingAgentMessage,
  MessageFilterOptions,
  SessionFilterOptions,
  ContinueOptions,
  ForkOptions,
  Result,
  AgentError,
  AgentErrorCode,
} from './coding-agent-adapter';

// Result helpers
export { ok, err, agentError } from './coding-agent-adapter';
