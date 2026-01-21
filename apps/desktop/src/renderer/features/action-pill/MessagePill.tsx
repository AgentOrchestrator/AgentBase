/**
 * MessagePill Container Component
 *
 * Connects the MessagePill feature to the Zustand store and service layer.
 * Integrates with ActionPill's highlighted agent for targeted messaging.
 */

import { useCallback, useEffect } from 'react';
import { useActionPillHighlight } from './hooks';
import { MessagePillPresentation } from './MessagePillPresentation';
import { messagePillService } from './services/MessagePillService';
import { selectCanSend, useMessagePillStore } from './store/messagePillStore';

export function MessagePill() {
  // Store state
  const inputValue = useMessagePillStore((state) => state.inputValue);
  const isSending = useMessagePillStore((state) => state.isSending);
  const targetAgentId = useMessagePillStore((state) => state.targetAgentId);
  const canSend = useMessagePillStore(selectCanSend);

  // Store actions
  const setInputValue = useMessagePillStore((state) => state.setInputValue);
  const setTargetAgent = useMessagePillStore((state) => state.setTargetAgent);

  // Get highlighted agent from ActionPill
  const { highlightedAgentId } = useActionPillHighlight();

  // Sync target agent with ActionPill's highlighted agent
  useEffect(() => {
    setTargetAgent(highlightedAgentId);
  }, [highlightedAgentId, setTargetAgent]);

  // Send handler
  const handleSend = useCallback(async () => {
    if (!canSend) return;

    // Get agent info for the target
    const agentIdToUse = targetAgentId;

    if (agentIdToUse) {
      const agentInfo = messagePillService.getAgentInfo(agentIdToUse);

      if (agentInfo) {
        const result = await messagePillService.sendMessage(inputValue, agentInfo);

        if (!result.success) {
          console.error('[MessagePill] Failed to send:', result.error);
        }
      } else {
        console.warn('[MessagePill] No agent info found for:', agentIdToUse);
      }
    } else {
      // No target agent - could show a picker or send to a default
      console.log('[MessagePill] No target agent, message:', inputValue);
      // For now, just clear the input
      useMessagePillStore.getState().clearInput();
    }
  }, [canSend, targetAgentId, inputValue]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <MessagePillPresentation
      inputValue={inputValue}
      isSending={isSending}
      targetAgentId={targetAgentId}
      canSend={canSend}
      onInputChange={setInputValue}
      onSend={handleSend}
      onKeyDown={handleKeyDown}
    />
  );
}
