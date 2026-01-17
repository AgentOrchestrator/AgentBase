/**
 * JSONL Filter Module
 *
 * Provides filtering capabilities for Claude Code JSONL session files,
 * allowing users to include only messages up to a specific point when forking.
 */

// Filter functions
export {
  extractMessageMetadata,
  filterByMessageId,
  filterByTimestamp,
  filterJsonl,
} from './JsonlFilterModule';
// Types (re-exported from shared + internal types)
export type {
  FilterOptions,
  FilterResult,
  MessageMetadata,
  ParsedJsonlLine,
} from './types';
