/**
 * Automation Types
 *
 * Core types for the automation/expose system.
 * Designed to be transport-agnostic - works with Electron IPC, WebSocket, or any other transport.
 */

/**
 * A binding can be:
 * - A primitive value (read-only)
 * - A function (action)
 * - A getter/setter pair (read-write state)
 */
export type BindingValue =
  | unknown // Primitive - read-only
  | ((...args: unknown[]) => unknown) // Function - action
  | { get: () => unknown; set: (value: unknown) => void }; // Accessor - read-write

/**
 * Map of binding names to their values
 */
export type Bindings = Record<string, BindingValue>;

/**
 * Registered expose entry
 */
export interface ExposeEntry {
  /** Unique identifier */
  id: string;
  /** The bindings (kept as ref for fresh access) */
  bindings: Bindings;
  /** Optional tags for filtering (like session IDs in logging) */
  tags: string[];
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Result of calling an exposed action
 */
export interface CallResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Result of getting an exposed value
 */
export interface GetResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

/**
 * Result of setting an exposed value
 */
export interface SetResult {
  success: boolean;
  error?: string;
}

/**
 * Info about an exposed entry (for listing)
 */
export interface ExposeInfo {
  id: string;
  keys: string[];
  tags: string[];
  registeredAt: number;
}

/**
 * Transport interface - how the registry communicates with external agents
 *
 * Implementations:
 * - ElectronTransport: Uses IPC to main process MCP server
 * - WebSocketTransport: Connects to external automation server
 * - InProcessTransport: Direct access (for SSR or testing)
 */
export interface AutomationTransport {
  /**
   * Called when a new entry is registered
   */
  onRegister?(entry: ExposeInfo): void;

  /**
   * Called when an entry is unregistered
   */
  onUnregister?(id: string): void;

  /**
   * Connect the transport (if needed)
   */
  connect?(): Promise<void>;

  /**
   * Disconnect the transport
   */
  disconnect?(): void;
}

/**
 * Request types for transport handlers
 */
export type AutomationRequest =
  | { type: 'list'; filter?: { tag?: string } }
  | { type: 'get'; id: string; key: string }
  | { type: 'set'; id: string; key: string; value: unknown }
  | { type: 'call'; id: string; key: string; args?: unknown[] };

/**
 * Response types from transport handlers
 */
export type AutomationResponse =
  | { type: 'list'; entries: ExposeInfo[] }
  | { type: 'get'; result: GetResult }
  | { type: 'set'; result: SetResult }
  | { type: 'call'; result: CallResult };
