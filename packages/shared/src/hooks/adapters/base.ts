/**
 * Base Adapter Interface
 *
 * Defines the contract for agent-specific adapters that translate
 * vendor events into the vendor-agnostic AgentEvent format.
 */

import type { AgentType } from '../../loaders/types.js';
import type { AgentEvent, AgentEventType } from '../types.js';

/**
 * Required context for building events from terminal output
 */
export interface TerminalEventContext {
  agentId: string;
  sessionId: string;
  workspacePath: string;
  gitBranch: string;
}

/**
 * Interface for agent-specific event adapters
 *
 * Each coding agent (Claude Code, Codex, etc.) has different event formats.
 * Adapters translate these vendor-specific formats into the unified AgentEvent format.
 */
export interface IAgentAdapter {
  /** The agent type this adapter handles */
  readonly agentType: AgentType;

  /**
   * Parse raw vendor data into an AgentEvent
   *
   * @param rawData - Vendor-specific event data (must include context fields)
   * @returns Parsed AgentEvent or null if data cannot be parsed
   * @throws Error if required context fields are missing
   */
  parse(rawData: unknown): AgentEvent | null;

  /**
   * Parse terminal output to detect events
   *
   * CLI-based agents (Claude Code, Codex) output events to the terminal.
   * This method extracts structured events from terminal text.
   *
   * @param output - Terminal output string
   * @param context - Required context for building events (agentId, sessionId, etc.)
   * @returns Array of detected events (may be empty)
   */
  parseTerminalOutput?(output: string, context: TerminalEventContext): AgentEvent[];

  /**
   * Map a vendor-specific event type to the abstract AgentEventType
   *
   * @param vendorType - Vendor-specific event type string
   * @returns Mapped AgentEventType or null if not mappable
   */
  mapEventType(vendorType: string): AgentEventType | null;
}

/**
 * Registry for managing multiple adapters
 */
export class AdapterRegistry {
  private adapters = new Map<AgentType, IAgentAdapter>();

  /**
   * Register an adapter for an agent type
   */
  register(adapter: IAgentAdapter): void {
    this.adapters.set(adapter.agentType, adapter);
  }

  /**
   * Unregister an adapter
   */
  unregister(agentType: AgentType): void {
    this.adapters.delete(agentType);
  }

  /**
   * Get an adapter by agent type
   */
  get(agentType: AgentType): IAgentAdapter | undefined {
    return this.adapters.get(agentType);
  }

  /**
   * Get all registered adapters
   */
  getAll(): IAgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Parse data using the appropriate adapter
   *
   * @param agentType - Agent type to use
   * @param data - Raw data to parse
   * @returns Parsed event or null
   */
  parse(agentType: AgentType, data: unknown): AgentEvent | null {
    const adapter = this.adapters.get(agentType);
    if (!adapter) {
      console.warn(`[AdapterRegistry] No adapter registered for ${agentType}`);
      return null;
    }
    return adapter.parse(data);
  }

  /**
   * Parse terminal output using the appropriate adapter
   *
   * @param agentType - Agent type to use
   * @param output - Terminal output to parse
   * @param context - Required context for building events
   * @returns Array of detected events
   */
  parseTerminalOutput(
    agentType: AgentType,
    output: string,
    context: TerminalEventContext
  ): AgentEvent[] {
    const adapter = this.adapters.get(agentType);
    if (!adapter?.parseTerminalOutput) {
      return [];
    }
    return adapter.parseTerminalOutput(output, context);
  }
}

/**
 * Create a new adapter registry
 */
export function createAdapterRegistry(): AdapterRegistry {
  return new AdapterRegistry();
}
