/**
 * useActiveAgent Hook
 *
 * Provides the active agent's information and message channel
 * based on the currently selected action.
 *
 * Used by MessagePill to send messages to the correct agent
 * without knowing the underlying transport mechanism.
 */

import { useMemo } from 'react';
import { createMessageChannel, type MessageChannel } from '../services/MessageChannel';
import { selectActiveAction, useActionPillStore } from '../store';

export interface ActiveAgentState {
  /** The agent ID of the currently active action */
  agentId: string | null;
  /** Message channel for sending to this agent (null if no valid target) */
  channel: MessageChannel | null;
}

/**
 * Hook to get the active agent's information and message channel.
 *
 * The active agent is determined by the activeActionIndex in the store,
 * which cycles through sorted actions when user presses ArrowUp/ArrowDown.
 *
 * @example
 * ```tsx
 * const { agentId, channel } = useActiveAgent();
 *
 * const handleSend = async () => {
 *   if (channel) {
 *     await channel.send(message);
 *   }
 * };
 * ```
 */
export function useActiveAgent(): ActiveAgentState {
  const activeAction = useActionPillStore(selectActiveAction);

  // Memoize channel creation to avoid recreating on every render
  const channel = useMemo(() => {
    if (!activeAction) return null;
    return createMessageChannel(activeAction);
  }, [activeAction]);

  if (!activeAction) {
    return {
      agentId: null,
      channel: null,
    };
  }

  return {
    agentId: activeAction.agentId,
    channel,
  };
}
