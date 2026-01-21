/**
 * useActionPillHighlight Hook
 *
 * Provides highlight state for the ActionPill feature.
 * Determines when the pill should glow and which agent node should highlight.
 */

import { useActionPillStore } from '../store';

export interface ActionPillHighlightState {
  /**
   * Whether the pill should show the "new actions" highlight effect.
   * True when there are unviewed actions.
   */
  shouldHighlightPill: boolean;

  /**
   * The agent ID that should be highlighted in the canvas.
   * Only set when the pill is expanded and there's a topmost action.
   */
  highlightedAgentId: string | null;
}

/**
 * Hook to get highlight state for ActionPill and Canvas
 *
 * @example
 * ```tsx
 * // In ActionPill component
 * const { shouldHighlightPill } = useActionPillHighlight();
 * return <div className={shouldHighlightPill ? 'glowing' : ''}>...</div>;
 *
 * // In Canvas component
 * const { highlightedAgentId } = useActionPillHighlight();
 * const isHighlighted = node.data?.agentId === highlightedAgentId;
 * ```
 */
export function useActionPillHighlight(): ActionPillHighlightState {
  const hasNewActions = useActionPillStore((state) => state.hasNewActions);
  const actionCount = useActionPillStore((state) => state.actions.length);
  const highlightedAgentId = useActionPillStore((state) => state.highlightedAgentId);

  // Pill should glow when:
  // 1. There are actions AND
  // 2. User hasn't viewed them yet (hasNewActions = true)
  const shouldHighlightPill = hasNewActions && actionCount > 0;

  return {
    shouldHighlightPill,
    highlightedAgentId,
  };
}
