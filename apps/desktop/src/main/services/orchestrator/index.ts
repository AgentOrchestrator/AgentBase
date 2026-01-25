/**
 * Orchestrator Service Exports
 */

export { CANVAS_STATE_CHANNELS, IPCCanvasStateProvider } from './IPCCanvasStateProvider';
export type {
  AddOrchestratorMessageInput,
  AgentSessionData,
  AgentSessionMessage,
  AgentSummary,
  CreateAgentParams,
  ICanvasStateProvider,
  IOrchestratorDatabase,
  IOrchestratorService,
  OrchestratorConversation,
  OrchestratorHealth,
  OrchestratorMessage,
  OrchestratorResponse,
  StreamCallback,
  ToolCall,
} from './interfaces';
export { registerOrchestratorIpcHandlers } from './ipc';
export { OrchestratorService } from './OrchestratorService';
