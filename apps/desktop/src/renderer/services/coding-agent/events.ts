/**
 * Coding Agent Event Types
 *
 * Defines the typed event system for agent adapter communication.
 * Uses discriminated unions for type-safe event handling.
 */

// ============================================
// Event Types
// ============================================

/**
 * Event types for agent adapter
 */
export type AgentAdapterEventType =
  | 'permission:request'
  | 'permission:response'
  | 'session:start'
  | 'session:end'
  | 'status:change';

// ============================================
// Event Payloads
// ============================================

/**
 * Payload for permission request events.
 * Sent when an agent needs user approval for a tool operation.
 */
export interface PermissionRequestPayload {
  toolName: string;
  command?: string;
  filePath?: string;
  workingDirectory?: string;
  reason?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
}

/**
 * Payload for permission response events.
 * Sent when user responds to a permission request.
 */
export interface PermissionResponsePayload {
  action: 'allow' | 'deny' | 'modify';
  message?: string;
  modifiedPayload?: Record<string, unknown>;
}

/**
 * Payload for session events (start/end).
 */
export interface SessionPayload {
  sessionId: string;
  workspacePath?: string;
}

/**
 * Payload for status change events.
 */
export interface StatusPayload {
  status: 'idle' | 'running' | 'completed' | 'error';
  errorMessage?: string;
}

// ============================================
// Discriminated Union Event Type
// ============================================

/**
 * Discriminated union of all adapter events.
 * Allows type-safe event handling based on event type.
 */
export type AgentAdapterEvent =
  | {
      type: 'permission:request';
      payload: PermissionRequestPayload;
      agentId?: string;
      sessionId?: string;
    }
  | {
      type: 'permission:response';
      payload: PermissionResponsePayload;
      agentId?: string;
      sessionId?: string;
    }
  | { type: 'session:start'; payload: SessionPayload; agentId?: string }
  | { type: 'session:end'; payload: SessionPayload; agentId?: string }
  | { type: 'status:change'; payload: StatusPayload; agentId?: string; sessionId?: string };

// ============================================
// Event Handler Type
// ============================================

/**
 * Handler type for specific event types.
 * Extracts the correct event shape based on event type.
 */
export type AgentEventHandler<T extends AgentAdapterEventType> = (
  event: Extract<AgentAdapterEvent, { type: T }>
) => void;
