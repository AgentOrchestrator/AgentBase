// Result types
export {
  type Result,
  type AgentError,
  AgentErrorCode,
  ok,
  err,
  agentError,
} from './result.types';

// IPC API types
export { type CodingAgentAPI } from './ipc.types';

// Agent types
export {
  type CodingAgentType,
  type AgentCapabilities,
  type AgentConfig,
  DEFAULT_AGENT_CONFIG,
} from './agent.types';

// Session types
export {
  type SessionIdentifier,
  type SessionInfo,
  type CodingAgentSessionContent,
  type SessionContent,
  type SessionSummary,
  type SessionFilter,
  type SessionFilterOptions,
  type MessageFilterOptions,
  type SessionChange,
  type ContinueOptions,
  type ForkOptions,
  sessionById,
  sessionByName,
  latestSession,
} from './session.types';

// Message types
export {
  type CodingAgentMessage,
  type GenerateRequest,
  type GenerateResponse,
  type StreamCallback,
  type MessageType,
  type ToolCategory,
  type ToolInfo,
  type ThinkingInfo,
  type McpInfo,
  type ErrorInfo,
  type AgentContentBlock,
  type AgentTextBlock,
  type AgentThinkingBlock,
  type AgentRedactedThinkingBlock,
  type AgentToolUseBlock,
  type AgentServerToolUseBlock,
  type AgentWebSearchToolResultBlock,
  type AgentWebSearchToolResultContent,
  type AgentWebSearchResultBlock,
  type AgentWebSearchToolResultError,
  type AgentWebSearchToolResultErrorCode,
} from './message.types';
