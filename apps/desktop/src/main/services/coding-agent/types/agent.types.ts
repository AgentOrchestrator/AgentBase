import type { AgentType } from '@agent-orchestrator/shared';

/**
 * Re-export AgentType from shared package
 */
export type { AgentType };

/**
 * Alias for backwards compatibility
 * Supported coding agent types: 'claude_code' | 'codex' | 'cursor' | 'vscode' | 'windsurf' | 'factory' | 'other'
 */
export type CodingAgentType = AgentType;

/**
 * Agent capabilities for runtime capability checking
 */
export interface AgentCapabilities {
  /** All agents must support basic generation */
  canGenerate: boolean;
  /** Can resume/continue previous sessions */
  canResumeSession: boolean;
  /** Can fork existing sessions */
  canForkSession: boolean;
  /** Can list available sessions */
  canListSessions: boolean;
  /** Supports streaming output */
  supportsStreaming: boolean;
}

/**
 * Configuration for creating an agent instance
 */
export interface AgentConfig {
  /** The type of coding agent */
  type: CodingAgentType;
  /** Custom path to CLI executable (uses system PATH if not provided) */
  executablePath?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Additional environment variables */
  environment?: Record<string, string>;
}

/**
 * Default configuration values
 */
export const DEFAULT_AGENT_CONFIG = {
  timeout: 120_000, // 2 minutes
} as const;
