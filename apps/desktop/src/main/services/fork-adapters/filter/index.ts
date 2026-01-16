/**
 * JSONL Filter Module
 *
 * Provides filtering capabilities for Claude Code JSONL session files,
 * allowing users to include only messages up to a specific point when forking.
 */

// Types (re-exported from shared + internal types)
export type {
  FilterOptions,
  FilterResult,
  MessageMetadata,
  ParsedJsonlLine,
} from './types';

// Filter functions
export {
  filterByMessageId,
  filterByTimestamp,
  filterJsonl,
  extractMessageMetadata,
} from './JsonlFilterModule';
