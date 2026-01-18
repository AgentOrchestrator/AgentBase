/**
 * Filter types - re-exports from shared and internal types
 */

// Re-export shared types for convenience
export type {
  JsonlFilterOptions as FilterOptions,
  JsonlFilterResult as FilterResult,
  JsonlMessageMetadata as MessageMetadata,
} from '@agent-orchestrator/shared';

/**
 * Internal: Parsed JSONL line with fields relevant for filtering
 */
export interface ParsedJsonlLine {
  /** Unique identifier for conversation messages */
  uuid?: string;
  /** Message ID used in file-history-snapshot and other types */
  messageId?: string;
  /** ISO timestamp when the message was created */
  timestamp?: string;
  /** Parent message UUID for conversation tree */
  parentUuid?: string | null;
  /** Message type */
  type?: string;
  /** The raw line content */
  _rawLine: string;
}
