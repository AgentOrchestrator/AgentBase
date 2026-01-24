/**
 * ActionPill Hooks Exports
 */

// Re-export MessageChannel type for consumers
export type { MessageChannel } from '../services/MessageChannel';
export type { ActionPillHighlightState } from './useActionPillHighlight';
export { useActionPillHighlight } from './useActionPillHighlight';
export type { ActiveAgentState } from './useActiveAgent';
export { useActiveAgent } from './useActiveAgent';
export { useToolCompletionService } from './useToolCompletionService';
