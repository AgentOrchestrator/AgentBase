import type { CodingAgentType, AgentCapabilities } from './agent.types';
import type { GenerateRequest, GenerateResponse, StreamCallback } from './message.types';
import type {
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  SessionContent,
  SessionFilterOptions,
  MessageFilterOptions,
  ContinueOptions,
  ForkOptions,
} from './session.types';

export interface CodingAgentAPI {
  /** Generate a one-off response */
  generate: (
    agentType: CodingAgentType,
    request: GenerateRequest
  ) => Promise<GenerateResponse>;

  /** Generate a response with streaming */
  generateStreaming: (
    agentType: CodingAgentType,
    request: GenerateRequest,
    onChunk: StreamCallback
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
    parentIdentifier: SessionIdentifier,
    options?: ForkOptions
  ) => Promise<SessionInfo>;

  /** Get list of available agent types */
  getAvailableAgents: () => Promise<CodingAgentType[]>;

  /** Get capabilities for a specific agent type */
  getCapabilities: (agentType: CodingAgentType) => Promise<AgentCapabilities>;

  /** Check if a specific agent is available */
  isAgentAvailable: (agentType: CodingAgentType) => Promise<boolean>;

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
  ) => Promise<SessionContent | null>;

  /** Subscribe to stream chunks */
  onStreamChunk: (
    callback: (data: { requestId: string; chunk: string }) => void
  ) => () => void;
}
