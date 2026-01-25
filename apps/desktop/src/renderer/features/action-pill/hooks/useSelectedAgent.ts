/**
 * useSelectedAgent Hook
 *
 * Provides the selected agent's information and message channel
 * based on the currently selected action.
 *
 * Used by MessagePill to send messages to the correct agent
 * without knowing the underlying transport mechanism.
 */

import { useMemo } from 'react';
import { createMessageChannel, type MessageChannel } from '../services/MessageChannel';
import { selectSelectedAction, useActionPillStore } from '../store';

export interface SelectedAgentState {
  /** The agent ID of the currently selected action */
  agentId: string | null;
  /** Message channel for sending to this agent (null if no valid target) */
  channel: MessageChannel | null;
}

/**
 * Hook to get the selected agent's information and message channel.
 *
 * The selected agent is determined by the selectedActionIndex in the store,
 * which cycles through sorted actions when user presses ArrowUp/ArrowDown.
 *
 * @example
 * ```tsx
 * const { agentId, channel } = useSelectedAgent();
 *
 * const handleSend = async () => {
 *   if (channel) {
 *     await channel.send(message);
 *   }
 * };
 * ```
 */
export function useSelectedAgent(): SelectedAgentState {
  const selectedAction = useActionPillStore(selectSelectedAction);

  // Memoize channel creation to avoid recreating on every render
  const channel = useMemo(() => {
    if (!selectedAction) return null;
    return createMessageChannel(selectedAction);
  }, [selectedAction]);

  if (!selectedAction) {
    return {
      agentId: null,
      channel: null,
    };
  }

  return {
    agentId: selectedAction.agentId,
    channel,
  };
}
