/**
 * ActionPill Hooks Exports
 */

// Re-export MessageChannel type for consumers
export type { MessageChannel } from '../services/MessageChannel';
export type { ActionPillHighlightState } from './useActionPillHighlight';
export { useActionPillHighlight } from './useActionPillHighlight';
export type { AgentSelectionState } from './useAgentSelection';
export { useAgentSelection } from './useAgentSelection';
export type { SelectedAgentState } from './useSelectedAgent';
export { useSelectedAgent } from './useSelectedAgent';
export { useToolCompletionService } from './useToolCompletionService';
