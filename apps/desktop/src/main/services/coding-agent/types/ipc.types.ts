import type { AgentActionResponse, AgentEvent } from '@agent-orchestrator/shared';
import type { AgentCapabilities, CodingAgentType } from './agent.types';
import type {
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
  StreamingChunk,
  StructuredStreamCallback,
} from './message.types';
import type { AgentError, Result } from './result.types';
import type {
  CodingAgentSessionContent,
  ContinueOptions,
  ForkOptions,
  MessageFilterOptions,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
} from './session.types';

export interface CodingAgentAPI {
  /** Generate a one-off response */
  generate: (agentType: CodingAgentType, request: GenerateRequest) => Promise<GenerateResponse>;

  /** Generate a response with streaming */
  generateStreaming: (
    agentType: CodingAgentType,
    request: GenerateRequest,
    onChunk: StreamCallback
  ) => Promise<GenerateResponse>;

  /** Generate a response with structured streaming (content blocks) */
  generateStreamingStructured: (
    agentType: CodingAgentType,
    request: GenerateRequest,
    onChunk: StructuredStreamCallback
  ) => Promise<GenerateResponse>;

  /** Continue an existing session */
  continueSession: (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ) => Promise<GenerateResponse>;

  /** Continue an existing session with streaming */
  continueSessionStreaming: (
    agentType: CodingAgentType,
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ) => Promise<GenerateResponse>;

  /** Fork an existing session */
  forkSession: (
    agentType: CodingAgentType,
    options: ForkOptions
  ) => Promise<Result<SessionInfo, AgentError>>;

  /** Get list of available agent types */
  getAvailableAgents: () => Promise<CodingAgentType[]>;

  /** Get capabilities for a specific agent type */
  getCapabilities: (agentType: CodingAgentType) => Promise<AgentCapabilities>;

  /** Check if a specific agent is available */
  isAgentAvailable: (agentType: CodingAgentType) => Promise<boolean>;

  /** Get the latest session for a workspace path */
  getLatestSession: (
    agentType: CodingAgentType,
    workspacePath: string
  ) => Promise<{ id: string; updatedAt: string } | null>;

  /** Check if a session file exists (session is active) */
  checkSessionActive: (
    agentType: CodingAgentType,
    sessionId: string,
    workspacePath: string
  ) => Promise<boolean>;

  /** List session summaries (without full messages) */
  listSessionSummaries: (
    agentType: CodingAgentType,
    filter?: SessionFilterOptions
  ) => Promise<SessionSummary[]>;

  /** Get full session content */
  getSession: (
    agentType: CodingAgentType,
    sessionId: string,
    filter?: MessageFilterOptions
  ) => Promise<CodingAgentSessionContent | null>;

  /** Subscribe to stream chunks */
  onStreamChunk: (callback: (data: { requestId: string; chunk: string }) => void) => () => void;

  /** Subscribe to structured stream chunks (content blocks) */
  onStreamChunkStructured: (
    callback: (data: { requestId: string; chunk: StreamingChunk }) => void
  ) => () => void;

  /** Subscribe to agent hook events */
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void;

  /** Respond to pending agent actions (permissions/questions) */
  respondToAction: (response: AgentActionResponse) => Promise<void>;
}
